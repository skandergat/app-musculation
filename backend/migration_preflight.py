#!/usr/bin/env python3
"""Read-only preflight for a future LIFTELY SQLite -> PostgreSQL migration.

This script NEVER inserts, updates, deletes, creates, or alters database objects.
It expects an existing SQLite source file and an already-initialized PostgreSQL
target schema. It reports blockers; it does not perform the migration.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

TABLES = (
    "exercices",
    "users",
    "sessions",
    "auth_action_tokens",
    "auth_mail_limits",
    "templates",
    "template_exercices",
    "seances",
    "series",
    "seance_exercices",
)
ID_TABLES = (
    "exercices",
    "users",
    "templates",
    "template_exercices",
    "seances",
    "series",
    "seance_exercices",
)


def sqlite_table_names(conn: sqlite3.Connection) -> set[str]:
    return {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }


def postgres_table_columns(conn, table: str) -> set[str]:
    rows = conn.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = %s
        """,
        (table,),
    ).fetchall()
    return {row[0] for row in rows}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sqlite",
        required=True,
        help="Path to the SQLite source database (opened read-only)",
    )
    args = parser.parse_args()

    database_url = os.getenv("LIFTELY_DATABASE_URL", "").strip()
    if not database_url:
        parser.error("LIFTELY_DATABASE_URL is not set; no connection was attempted.")

    source = Path(args.sqlite).expanduser().resolve()
    if not source.is_file():
        parser.error(f"SQLite source file not found: {source}")

    report: dict = {
        "mode": "READ_ONLY_PREFLIGHT",
        "source": str(source),
        "target": "PostgreSQL from LIFTELY_DATABASE_URL (URL hidden)",
        "writes_performed": False,
        "tables": {},
        "blockers": [],
        "warnings": [],
    }

    # SQLite URI mode=ro prevents accidental source changes.
    sqlite_uri = source.as_uri() + "?mode=ro"
    src = sqlite3.connect(sqlite_uri, uri=True)
    src.row_factory = sqlite3.Row
    try:
        src.execute("PRAGMA query_only = ON")
        source_tables = sqlite_table_names(src)
        missing_source = sorted(set(TABLES) - source_tables)
        if missing_source:
            report["blockers"].append(
                {"type": "missing_source_tables", "tables": missing_source}
            )

        fk_violations = []
        for row in src.execute("PRAGMA foreign_key_check").fetchall():
            fk_violations.append(
                {
                    "table": row[0],
                    "rowid": row[1],
                    "parent_table": row[2],
                    "fk_index": row[3],
                }
            )
        if fk_violations:
            report["blockers"].append(
                {
                    "type": "sqlite_foreign_key_violations",
                    "count": len(fk_violations),
                    "examples": fk_violations[:20],
                }
            )

        source_counts = {}
        source_ids = {}
        source_columns = {}
        for table in TABLES:
            if table not in source_tables:
                continue
            source_counts[table] = src.execute(
                f'SELECT COUNT(*) FROM "{table}"'
            ).fetchone()[0]
            source_columns[table] = {
                row[1] for row in src.execute(f'PRAGMA table_info("{table}")')
            }
            if table in ID_TABLES and "id" in source_columns[table]:
                source_ids[table] = {
                    row[0]
                    for row in src.execute(f'SELECT id FROM "{table}"').fetchall()
                    if row[0] is not None
                }
    finally:
        src.close()

    # Import psycopg only after validating the source path and environment.
    try:
        import psycopg
    except ImportError:
        parser.error("psycopg is not installed in this Python environment.")

    try:
        # PostgreSQL server-side read-only transaction is an additional guard.
        with psycopg.connect(
            database_url,
            connect_timeout=10,
            options="-c default_transaction_read_only=on",
        ) as dst:
            with dst.transaction():
                dst.execute("SET TRANSACTION READ ONLY")
                target_columns = {}
                target_counts = {}
                target_ids = {}
                for table in TABLES:
                    columns = postgres_table_columns(dst, table)
                    if not columns:
                        report["tables"][table] = {
                            "source_count": source_counts.get(table),
                            "target_count": None,
                            "status": "TARGET_TABLE_MISSING",
                        }
                        report["blockers"].append(
                            {"type": "missing_target_table", "table": table}
                        )
                        continue

                    target_columns[table] = columns
                    target_counts[table] = dst.execute(
                        f'SELECT COUNT(*) FROM "{table}"'
                    ).fetchone()[0]
                    missing_columns = sorted(
                        source_columns.get(table, set()) - columns
                    )
                    if missing_columns:
                        report["blockers"].append(
                            {
                                "type": "target_missing_columns",
                                "table": table,
                                "columns": missing_columns,
                            }
                        )

                    if table in ID_TABLES and "id" in columns:
                        target_ids[table] = {
                            row[0]
                            for row in dst.execute(
                                f'SELECT id FROM "{table}"'
                            ).fetchall()
                            if row[0] is not None
                        }

                    report["tables"][table] = {
                        "source_count": source_counts.get(table),
                        "target_count": target_counts[table],
                        "count_difference": (
                            target_counts[table] - source_counts[table]
                            if table in source_counts
                            else None
                        ),
                        "source_columns_missing_on_target": missing_columns,
                        "status": "REVIEW",
                    }

                for table, ids in source_ids.items():
                    overlap = ids.intersection(target_ids.get(table, set()))
                    if overlap:
                        report["blockers"].append(
                            {
                                "type": "primary_key_id_collisions",
                                "table": table,
                                "count": len(overlap),
                                "sample_ids": sorted(overlap)[:20],
                            }
                        )

                nonempty_targets = [
                    table
                    for table, count in target_counts.items()
                    if count > 0
                ]
                if nonempty_targets:
                    report["warnings"].append(
                        {
                            "type": "target_contains_data",
                            "tables": nonempty_targets,
                            "note": (
                                "No rows were changed. A migration plan must define "
                                "how existing target rows are reconciled before import."
                            ),
                        }
                    )
    except Exception as exc:
        # Do not print the connection URL or driver exception text, which can
        # include connection details in some environments.
        report["blockers"].append(
            {
                "type": "postgres_read_only_connection_failed",
                "exception_type": type(exc).__name__,
                "note": "Connection details intentionally omitted.",
            }
        )

    report["result"] = "BLOCKED" if report["blockers"] else "REVIEW_REQUIRED"
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 2 if report["blockers"] else 0


if __name__ == "__main__":
    sys.exit(main())
