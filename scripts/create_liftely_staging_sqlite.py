#!/usr/bin/env python3
"""Create an isolated SQLite staging database from the sanitized repository fixture.

The generated database contains the 349-exercise catalogue and empty account,
session, workout, and authentication tables. It never reads the developer's
local database and refuses to overwrite an existing output file.
"""
from __future__ import annotations

import argparse
import base64
import gzip
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "backend" / "fixtures" / "reset_staging_source.sql.gz.b64"
TABLES = (
    "exercices",
    "users",
    "sessions",
    "auth_action_tokens",
    "auth_mail_limits",
    "auth_login_limits",
    "templates",
    "template_exercices",
    "seances",
    "series",
    "seance_exercices",
)
EXPECTED_COUNTS = {
    "exercices": 349,
    "users": 0,
    "sessions": 0,
    "auth_action_tokens": 0,
    "auth_mail_limits": 0,
    "auth_login_limits": 0,
    "templates": 0,
    "template_exercices": 0,
    "seances": 0,
    "series": 0,
    "seance_exercices": 0,
}


def create_database(output: Path) -> dict[str, int]:
    output = output.expanduser().resolve()
    if output.is_relative_to(ROOT):
        raise ValueError("Choose an output path outside the repository.")
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite existing file: {output}")
    if not FIXTURE.is_file():
        raise FileNotFoundError(f"Sanitized staging fixture not found: {FIXTURE}")

    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        encoded = "".join(FIXTURE.read_text(encoding="ascii").split())
        compressed = base64.b64decode(encoded, validate=True)
        source_sql = gzip.decompress(compressed).decode("utf-8")

        with sqlite3.connect(output) as conn:
            conn.execute("PRAGMA foreign_keys = ON")
            conn.executescript(source_sql)
            conn.execute(
                "CREATE TABLE IF NOT EXISTS auth_login_limits ("
                "key_hash TEXT PRIMARY KEY, "
                "window_start TEXT NOT NULL, "
                "request_count INTEGER NOT NULL)"
            )
            conn.commit()

            integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
            foreign_key_errors = conn.execute("PRAGMA foreign_key_check").fetchall()
            counts = {
                table: conn.execute(
                    f'SELECT COUNT(*) FROM "{table}"'
                ).fetchone()[0]
                for table in TABLES
            }

        if integrity != "ok" or foreign_key_errors:
            raise RuntimeError(
                f"SQLite validation failed: integrity={integrity}, "
                f"foreign_key_errors={len(foreign_key_errors)}"
            )
        if counts != EXPECTED_COUNTS:
            raise RuntimeError(f"Unexpected staging fixture row counts: {counts}")

        return counts
    except Exception:
        output.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default=str(Path.home() / "LIFTELY-Backups" / "staging" / "liftely-staging.sqlite"),
        help="New SQLite staging file; existing files are never overwritten.",
    )
    args = parser.parse_args()

    try:
        counts = create_database(Path(args.output))
    except Exception as exc:
        print(f"STAGING DATABASE NOT CREATED: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    print("STAGING DATABASE CREATED AND VERIFIED")
    print(f"Path: {Path(args.output).expanduser().resolve()}")
    for table, count in counts.items():
        print(f"{table}: {count}")
    print("Integrity: ok; foreign-key violations: 0")
    print("Contains only the public exercise catalogue and empty user data.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
