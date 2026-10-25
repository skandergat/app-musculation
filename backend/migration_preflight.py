#!/usr/bin/env python3
"""Read-only preflight for a future LIFTELY SQLite -> PostgreSQL migration.

The script never inserts, updates, deletes, creates, or alters database objects.
It expects an existing SQLite source file and an initialized PostgreSQL target
schema. It compares schema, foreign keys, row counts, and actual row contents.
"""
from __future__ import annotations

import argparse
import base64
from collections import Counter
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any

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


def quote_identifier(value: str) -> str:
    """Quote an SQL identifier. Inputs are schema/table/column names, never values."""
    return '"' + value.replace('"', '""') + '"'


def sqlite_table_names(conn: sqlite3.Connection) -> set[str]:
    return {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }


def postgres_table_columns(conn, schema: str, table: str) -> set[str]:
    rows = conn.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        """,
        (schema, table),
    ).fetchall()
    return {row[0] for row in rows}


def canonical_value(value: Any) -> Any:
    """Normalize common SQLite/PostgreSQL type differences without exposing values."""
    if value is None:
        return ["null"]
    if isinstance(value, bool):
        return ["bool", value]
    if isinstance(value, (int, float, Decimal)):
        try:
            number = Decimal(str(value))
            if number.is_finite():
                number = number.normalize()
                if number == 0:
                    number = Decimal(0)
                return ["number", format(number, "f")]
        except (InvalidOperation, ValueError):
            pass
        return ["number_text", str(value)]
    if isinstance(value, (bytes, bytearray, memoryview)):
        return ["bytes", base64.b64encode(bytes(value)).decode("ascii")]
    if isinstance(value, (datetime, date, time)):
        return [type(value).__name__, value.isoformat()]
    return ["text", str(value)]


def row_signature(values: list[Any] | tuple[Any, ...]) -> str:
    encoded = json.dumps(
        [canonical_value(value) for value in values],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def compare_row_multisets(
    source_rows: list[tuple[Any, ...]], target_rows: list[tuple[Any, ...]]
) -> dict[str, Any]:
    """Compare full row content while preserving duplicate-row multiplicity."""
    source_signatures = Counter(row_signature(row) for row in source_rows)
    target_signatures = Counter(row_signature(row) for row in target_rows)
    missing = source_signatures - target_signatures
    extra = target_signatures - source_signatures
    return {
        "matches": not missing and not extra,
        "source_rows_missing_on_target": sum(missing.values()),
        "target_rows_not_in_source": sum(extra.values()),
        "missing_row_fingerprints": [
            signature[:16]
            for signature, count in sorted(missing.items())
            for _ in range(min(count, 3))
        ][:10],
        "extra_row_fingerprints": [
            signature[:16]
            for signature, count in sorted(extra.items())
            for _ in range(min(count, 3))
        ][:10],
    }


def sqlite_foreign_keys(src: sqlite3.Connection) -> set[tuple[str, str, str, str, str]]:
    expected = set()
    for table in TABLES:
        for row in src.execute(f"PRAGMA foreign_key_list({quote_identifier(table)})"):
            expected.add(
                (
                    table,
                    str(row[3]),
                    str(row[2]),
                    str(row[4]),
                    str(row[6]).upper(),
                )
            )
    return expected


def postgres_foreign_keys(dst, schema: str) -> set[tuple[str, str, str, str, str]]:
    rows = dst.execute(
        """
        SELECT tc.table_name, kcu.column_name,
               ccu.table_name AS foreign_table_name,
               ccu.column_name AS foreign_column_name,
               rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_catalog = kcu.constraint_catalog
         AND tc.constraint_schema = kcu.constraint_schema
         AND tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_catalog = ccu.constraint_catalog
         AND tc.constraint_schema = ccu.constraint_schema
         AND tc.constraint_name = ccu.constraint_name
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_catalog = rc.constraint_catalog
         AND tc.constraint_schema = rc.constraint_schema
         AND tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_schema = %s
          AND tc.table_name = ANY(%s)
          AND ccu.table_schema = %s
        """,
        (schema, list(TABLES), schema),
    ).fetchall()
    return {
        (str(r[0]), str(r[1]), str(r[2]), str(r[3]), str(r[4]).upper())
        for r in rows
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sqlite",
        required=True,
        help="Path to the SQLite source database (opened read-only)",
    )
    parser.add_argument(
        "--schema",
        default="public",
        help="PostgreSQL schema to inspect (default: public)",
    )
    args = parser.parse_args()

    database_url = os.getenv("LIFTELY_DATABASE_URL", "").strip()
    if not database_url:
        parser.error("LIFTELY_DATABASE_URL is not set; no connection was attempted.")

    source = Path(args.sqlite).expanduser().resolve()
    if not source.is_file():
        parser.error(f"SQLite source file not found: {source}")

    report: dict[str, Any] = {
        "mode": "READ_ONLY_PREFLIGHT",
        "source": str(source),
        "target": f"PostgreSQL schema {args.schema!r} from LIFTELY_DATABASE_URL (URL hidden)",
        "writes_performed": False,
        "tables": {},
        "blockers": [],
        "warnings": [],
        "foreign_keys": {},
    }

    source_rows_by_table: dict[str, list[tuple[Any, ...]]] = {}
    source_columns: dict[str, list[str]] = {}
    source_counts: dict[str, int] = {}
    source_fks: set[tuple[str, str, str, str, str]] = set()

    # SQLite URI mode=ro and query_only guard against source changes.
    sqlite_uri = source.as_uri() + "?mode=ro"
    try:
        src = sqlite3.connect(sqlite_uri, uri=True)
    except sqlite3.Error as exc:
        parser.error(f"Could not open SQLite source read-only ({type(exc).__name__}).")
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

        source_fks = sqlite_foreign_keys(src)
        for table in TABLES:
            if table not in source_tables:
                continue
            columns = [
                row[1] for row in src.execute(
                    f"PRAGMA table_info({quote_identifier(table)})"
                ).fetchall()
            ]
            source_columns[table] = columns
            source_rows = src.execute(
                f"SELECT {', '.join(quote_identifier(c) for c in columns)} "
                f"FROM {quote_identifier(table)}"
            ).fetchall()
            rows = [tuple(row[column] for column in columns) for row in source_rows]
            source_rows_by_table[table] = rows
            source_counts[table] = len(rows)
    finally:
        src.close()

    try:
        import psycopg
    except ImportError:
        parser.error("psycopg is not installed in this Python environment.")

    try:
        # Both the connection option and SET TRANSACTION are read-only guards.
        with psycopg.connect(
            database_url,
            connect_timeout=10,
            options="-c default_transaction_read_only=on",
        ) as dst:
            with dst.transaction():
                dst.execute("SET TRANSACTION READ ONLY")
                target_columns: dict[str, set[str]] = {}
                target_counts: dict[str, int] = {}
                target_ids: dict[str, dict[Any, str]] = {}

                for table in TABLES:
                    if table not in source_tables:
                        # Do not present a target-only table as CONTENT_MATCH:
                        # an absent source table is a schema blocker, not an empty table.
                        report["tables"][table] = {
                            "source_count": None,
                            "target_count": None,
                            "status": "SOURCE_TABLE_MISSING",
                        }
                        continue

                    columns = postgres_table_columns(dst, args.schema, table)
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
                    missing_columns = sorted(
                        set(source_columns.get(table, [])) - columns
                    )
                    if missing_columns:
                        report["blockers"].append(
                            {
                                "type": "target_missing_columns",
                                "table": table,
                                "columns": missing_columns,
                            }
                        )

                    target_name = (
                        f"{quote_identifier(args.schema)}.{quote_identifier(table)}"
                    )
                    target_counts[table] = dst.execute(
                        f"SELECT COUNT(*) FROM {target_name}"
                    ).fetchone()[0]

                    comparable_columns = [
                        column
                        for column in source_columns.get(table, [])
                        if column in columns
                    ]
                    if len(comparable_columns) != len(source_columns.get(table, [])):
                        target_rows = []
                    elif comparable_columns:
                        selected = ", ".join(
                            quote_identifier(column) for column in comparable_columns
                        )
                        target_rows = [
                            tuple(row)
                            for row in dst.execute(
                                f"SELECT {selected} FROM {target_name}"
                            ).fetchall()
                        ]
                    else:
                        target_rows = []

                    source_rows = source_rows_by_table.get(table, [])
                    comparison = compare_row_multisets(source_rows, target_rows)
                    source_count = source_counts.get(table, 0)
                    target_count = target_counts[table]

                    if source_count > 0 and target_count == 0:
                        status = "READY_FOR_IMPORT"
                    elif comparison["matches"]:
                        status = "CONTENT_MATCH"
                    else:
                        status = "DATA_MISMATCH"
                        report["blockers"].append(
                            {
                                "type": "target_data_differs_from_source",
                                "table": table,
                                "source_rows_missing_on_target": comparison[
                                    "source_rows_missing_on_target"
                                ],
                                "target_rows_not_in_source": comparison[
                                    "target_rows_not_in_source"
                                ],
                            }
                        )

                    report["tables"][table] = {
                        "source_count": source_count,
                        "target_count": target_count,
                        "count_difference": target_count - source_count,
                        "source_columns_missing_on_target": missing_columns,
                        "row_content_matches": comparison["matches"],
                        "source_rows_missing_on_target": comparison[
                            "source_rows_missing_on_target"
                        ],
                        "target_rows_not_in_source": comparison[
                            "target_rows_not_in_source"
                        ],
                        "row_fingerprint_samples": {
                            "missing": comparison["missing_row_fingerprints"],
                            "extra": comparison["extra_row_fingerprints"],
                        },
                        "status": status,
                    }

                    if (
                        table in ID_TABLES
                        and "id" in source_columns.get(table, [])
                        and "id" in columns
                        and not missing_columns
                    ):
                        source_id_index = source_columns[table].index("id")
                        source_id_map = {
                            row[source_id_index]: row_signature(row)
                            for row in source_rows_by_table.get(table, [])
                            if row[source_id_index] is not None
                        }
                        target_id_index = comparable_columns.index("id") if "id" in comparable_columns else -1
                        target_id_map = {
                            row[target_id_index]: row_signature(row)
                            for row in target_rows
                            if target_id_index >= 0 and row[target_id_index] is not None
                        }
                        overlap = set(source_id_map) & set(target_id_map)
                        conflicting = sorted(
                            (str(identifier) for identifier in overlap
                             if source_id_map[identifier] != target_id_map[identifier])
                        )
                        if overlap:
                            report["tables"][table]["overlapping_ids"] = len(overlap)
                        if conflicting:
                            report["blockers"].append(
                                {
                                    "type": "primary_key_id_collisions_with_different_data",
                                    "table": table,
                                    "count": len(conflicting),
                                    "sample_ids": conflicting[:20],
                                }
                            )

                expected_fks = {
                    fk for fk in source_fks if fk[0] in TABLES and fk[2] in TABLES
                }
                actual_fks = postgres_foreign_keys(dst, args.schema)
                missing_fks = sorted(expected_fks - actual_fks)
                extra_fks = sorted(actual_fks - expected_fks)
                report["foreign_keys"] = {
                    "source_count": len(expected_fks),
                    "target_count": len(actual_fks),
                    "missing_on_target": [
                        {
                            "table": fk[0],
                            "column": fk[1],
                            "references_table": fk[2],
                            "references_column": fk[3],
                            "on_delete": fk[4],
                        }
                        for fk in missing_fks
                    ],
                    "extra_on_target": [
                        {
                            "table": fk[0],
                            "column": fk[1],
                            "references_table": fk[2],
                            "references_column": fk[3],
                            "on_delete": fk[4],
                        }
                        for fk in extra_fks
                    ],
                }
                if missing_fks:
                    report["blockers"].append(
                        {"type": "target_missing_foreign_keys", "count": len(missing_fks)}
                    )
                if extra_fks:
                    report["warnings"].append(
                        {
                            "type": "target_has_additional_foreign_keys",
                            "count": len(extra_fks),
                            "note": "Review extra constraints before importing source rows.",
                        }
                    )

                unvalidated = dst.execute(
                    """
                    SELECT c.conname, t.relname
                    FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    JOIN pg_namespace n ON n.oid = t.relnamespace
                    WHERE c.contype = 'f'
                      AND c.convalidated = false
                      AND n.nspname = %s
                      AND t.relname = ANY(%s)
                    ORDER BY t.relname, c.conname
                    """,
                    (args.schema, list(TABLES)),
                ).fetchall()
                if unvalidated:
                    report["blockers"].append(
                        {
                            "type": "unvalidated_target_foreign_keys",
                            "constraints": [
                                {"table": row[1], "constraint": row[0]}
                                for row in unvalidated
                            ],
                        }
                    )

                nonempty_targets = [
                    table for table, count in target_counts.items() if count > 0
                ]
                if nonempty_targets:
                    report["warnings"].append(
                        {
                            "type": "target_contains_data",
                            "tables": nonempty_targets,
                            "note": (
                                "No rows were changed. Existing target rows require "
                                "an explicit reconciliation plan before migration."
                            ),
                        }
                    )
                if not nonempty_targets and any(count > 0 for count in source_counts.values()):
                    report["warnings"].append(
                        {
                            "type": "empty_target_ready_for_import",
                            "note": "Target tables are empty; row-content differences are expected before import.",
                        }
                    )
    except Exception as exc:
        # Driver exception messages can contain connection details or credentials.
        report["blockers"].append(
            {
                "type": "postgres_read_only_inspection_failed",
                "exception_type": type(exc).__name__,
                "note": "Connection details intentionally omitted.",
            }
        )

    report["result"] = "BLOCKED" if report["blockers"] else "REVIEW_REQUIRED"
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 2 if report["blockers"] else 0


if __name__ == "__main__":
    sys.exit(main())
