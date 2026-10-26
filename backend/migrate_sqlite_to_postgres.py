#!/usr/bin/env python3
"""Import the validated SQLite staging database into an EMPTY PostgreSQL database.

Safety:
- Requires SUPABASE_DB_URL (or DATABASE_URL); never prints the connection string.
- Refuses to import if any target application table already contains rows.
- Runs the entire import in one PostgreSQL transaction.
- Does not modify the SQLite source file.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path

import psycopg
from psycopg import sql

TABLE_ORDER = (
    "users",
    "exercices",
    "auth_mail_limits",
    "sessions",
    "auth_action_tokens",
    "templates",
    "seances",
    "template_exercices",
    "series",
    "seance_exercices",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Path to migration_staging.db")
    parser.add_argument(
        "--schema",
        default=str(Path(__file__).with_name("postgres_schema.sql")),
        help="Path to postgres_schema.sql",
    )
    parser.add_argument(
        "--create-schema",
        action="store_true",
        help="Create missing tables/indexes before import (safe for an empty target).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_path = Path(args.source).expanduser().resolve()
    schema_path = Path(args.schema).expanduser().resolve()
    dsn = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")

    if not source_path.is_file():
        print(f"ERREUR : fichier source introuvable : {source_path}", file=sys.stderr)
        return 2
    if not schema_path.is_file():
        print(f"ERREUR : schéma introuvable : {schema_path}", file=sys.stderr)
        return 2
    if not dsn:
        print(
            "ERREUR : définis SUPABASE_DB_URL dans l'environnement "
            "(ne colle pas le secret dans le code ni dans le chat).",
            file=sys.stderr,
        )
        return 2

    source = sqlite3.connect(f"file:{source_path.as_posix()}?mode=ro", uri=True)
    source.row_factory = sqlite3.Row
    check = source.execute("PRAGMA integrity_check").fetchone()[0]
    fk_errors = source.execute("PRAGMA foreign_key_check").fetchall()
    if check != "ok" or fk_errors:
        print(f"ERREUR : source invalide (integrity={check}, FK={len(fk_errors)})", file=sys.stderr)
        source.close()
        return 3

    try:
        with psycopg.connect(dsn, connect_timeout=10) as target:
            with target.cursor() as cur:
                if args.create_schema:
                    cur.execute(schema_path.read_text(encoding="utf-8"))

                # Verify all expected tables exist before checking for existing data.
                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = current_schema()
                    """
                )
                existing_tables = {row[0] for row in cur.fetchall()}
                missing = set(TABLE_ORDER) - existing_tables
                if missing:
                    raise RuntimeError(
                        "Tables PostgreSQL manquantes : "
                        + ", ".join(sorted(missing))
                        + ". Applique postgres_schema.sql ou utilise --create-schema."
                    )

                for table in TABLE_ORDER:
                    cur.execute(
                        sql.SQL("SELECT EXISTS (SELECT 1 FROM {} LIMIT 1)").format(
                            sql.Identifier(table)
                        )
                    )
                    if cur.fetchone()[0]:
                        raise RuntimeError(
                            f"La table cible {table} n'est pas vide. "
                            "Import annulé sans écraser de données."
                        )

                expected_counts: dict[str, int] = {}
                for table in TABLE_ORDER:
                    source_tables = {
                        row[0]
                        for row in source.execute(
                            "SELECT name FROM sqlite_master WHERE type='table'"
                        ).fetchall()
                    }
                    if table not in source_tables:
                        raise RuntimeError(f"Table source manquante : {table}")

                    source_columns = [
                        row["name"]
                        for row in source.execute(f'PRAGMA table_info("{table}")').fetchall()
                    ]
                    cur.execute(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = %s
                        ORDER BY ordinal_position
                        """,
                        (table,),
                    )
                    target_columns = [row[0] for row in cur.fetchall()]
                    if set(source_columns) != set(target_columns):
                        raise RuntimeError(
                            f"Colonnes incompatibles pour {table}: "
                            f"SQLite={source_columns}; PostgreSQL={target_columns}"
                        )

                    rows = source.execute(f'SELECT * FROM "{table}"').fetchall()
                    if rows:
                        insert = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                            sql.Identifier(table),
                            sql.SQL(", ").join(sql.Identifier(c) for c in source_columns),
                            sql.SQL(", ").join(sql.Placeholder() for _ in source_columns),
                        )
                        cur.executemany(
                            insert,
                            [tuple(row[column] for column in source_columns) for row in rows],
                        )
                    expected_counts[table] = len(rows)

                # Reset generated ID counters so new records do not collide with imported IDs.
                for table in ("users", "exercices", "templates", "template_exercices",
                              "seances", "series", "seance_exercices"):
                    cur.execute(
                        sql.SQL(
                            "SELECT setval(pg_get_serial_sequence(%s, 'id'), "
                            "COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM {}"
                        ).format(sql.Identifier(table)),
                        (table,),
                    )

                # Independent count check before commit.
                for table, expected in expected_counts.items():
                    cur.execute(
                        sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table))
                    )
                    actual = cur.fetchone()[0]
                    if actual != expected:
                        raise RuntimeError(
                            f"Écart de comptage {table}: source={expected}, cible={actual}"
                        )

            # psycopg commits on successful exit; any exception rolls back.
        print("IMPORT TERMINÉ — transaction PostgreSQL validée")
        for table, count in expected_counts.items():
            print(f"{table}: {count}")
        print("Source SQLite conservée et inchangée.")
        return 0
    except Exception as exc:
        print(f"IMPORT ANNULÉ : {type(exc).__name__}: {exc}", file=sys.stderr)
        return 4
    finally:
        source.close()


if __name__ == "__main__":
    raise SystemExit(main())
