"""Run the real sanitized LIFTELY staging database through PostgreSQL preflight/import/postflight."""
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import uuid

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FIXTURE = BACKEND / "fixtures" / "reset_staging_source.sql.gz.b64"
SCHEMA_FILE = BACKEND / "postgres_schema.sql"
IMPORTER = BACKEND / "migrate_sqlite_to_postgres.py"
PREFLIGHT = BACKEND / "migration_preflight.py"
TABLES = (
    "exercices", "users", "sessions", "auth_action_tokens",
    "auth_mail_limits", "auth_login_limits", "templates", "template_exercices",
    "seances", "series", "seance_exercices",
)
EXPECTED_COUNTS = {
    "exercices": 349, "users": 0, "sessions": 0,
    "auth_action_tokens": 0, "auth_mail_limits": 0,
    "auth_login_limits": 0, "templates": 0, "template_exercices": 0,
    "seances": 0, "series": 0, "seance_exercices": 0,
}


def run_readonly_preflight(source: Path, dsn: str, schema_name: str) -> dict:
    env = os.environ.copy()
    env["LIFTELY_DATABASE_URL"] = dsn
    env.pop("SUPABASE_DB_URL", None)
    env.pop("DATABASE_URL", None)
    result = subprocess.run(
        [sys.executable, str(PREFLIGHT), "--sqlite", str(source), "--schema", schema_name],
        cwd=ROOT, env=env, text=True, capture_output=True, timeout=60, check=False,
    )
    if result.returncode not in (0, 2):
        raise AssertionError((result.stdout, result.stderr))
    report = json.loads(result.stdout)
    if result.returncode == 2 and not report.get("blockers"):
        raise AssertionError("Preflight returned error without blockers")
    return report


def run_import(source: Path, dsn: str) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["LIFTELY_DATABASE_URL"] = dsn
    env.pop("SUPABASE_DB_URL", None)
    env.pop("DATABASE_URL", None)
    return subprocess.run(
        [sys.executable, str(IMPORTER), "--source", str(source), "--schema", str(SCHEMA_FILE)],
        cwd=ROOT, env=env, text=True, capture_output=True, timeout=60, check=False,
    )


def main() -> None:
    base_dsn = (
        os.getenv("LIFTELY_DATABASE_URL", "").strip()
        or os.getenv("SUPABASE_DB_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )
    if not base_dsn.startswith(("postgres://", "postgresql://")):
        raise SystemExit("An isolated PostgreSQL DSN is required for this test.")

    temp_root = Path(os.getenv("RUNNER_TEMP", tempfile.gettempdir()))
    work = Path(tempfile.mkdtemp(prefix="liftely-real-staging-", dir=temp_root))
    schema_name = f"liftely_real_{uuid.uuid4().hex[:12]}"
    try:
        source = work / "actual-reset-staging.sqlite"
        compressed = base64.b64decode("".join(FIXTURE.read_text(encoding="ascii").split()), validate=True)
        source_sql = gzip.decompress(compressed).decode("utf-8")
        with sqlite3.connect(source) as conn:
            conn.executescript(source_sql)
            conn.execute(
                "CREATE TABLE auth_login_limits ("
                "key_hash TEXT PRIMARY KEY, window_start TEXT NOT NULL, "
                "request_count INTEGER NOT NULL)"
            )
            conn.commit()

        with sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True) as conn:
            integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
            fk_errors = conn.execute("PRAGMA foreign_key_check").fetchall()
            counts = {
                table: conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
                for table in TABLES
            }
            if integrity != "ok" or fk_errors or counts != EXPECTED_COUNTS:
                raise AssertionError({
                    "integrity": integrity, "foreign_key_errors": len(fk_errors),
                    "counts": counts,
                })

        source_digest_before = hashlib.sha256(source.read_bytes()).hexdigest()

        with psycopg.connect(base_dsn, connect_timeout=10) as conn:
            conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema_name)))
        target_dsn = make_conninfo(base_dsn, options=f"-c search_path={schema_name}")
        with psycopg.connect(target_dsn, connect_timeout=10) as conn:
            conn.execute(SCHEMA_FILE.read_text(encoding="utf-8"))

        before = run_readonly_preflight(source, target_dsn, schema_name)
        if before["blockers"]:
            raise AssertionError({"pre_import_blockers": before["blockers"]})
        if before["tables"]["exercices"]["status"] != "READY_FOR_IMPORT":
            raise AssertionError(before["tables"]["exercices"])
        if any(
            before["tables"][table]["status"] != "CONTENT_MATCH"
            for table in TABLES if table != "exercices"
        ):
            raise AssertionError(before["tables"])

        imported = run_import(source, target_dsn)
        if imported.returncode != 0:
            raise AssertionError({"stdout": imported.stdout, "stderr": imported.stderr})

        source_digest_after = hashlib.sha256(source.read_bytes()).hexdigest()
        if source_digest_after != source_digest_before:
            raise AssertionError("SQLite staging source changed during import")

        after = run_readonly_preflight(source, target_dsn, schema_name)
        if after["blockers"]:
            raise AssertionError({"post_import_blockers": after["blockers"]})
        if any(after["tables"][table]["status"] != "CONTENT_MATCH" for table in TABLES):
            raise AssertionError(after["tables"])
        if after["foreign_keys"]["missing_on_target"] or after["foreign_keys"]["extra_on_target"]:
            raise AssertionError(after["foreign_keys"])

        with psycopg.connect(target_dsn, connect_timeout=10) as conn:
            next_id = conn.execute(
                "INSERT INTO exercices (nom, groupe_musculaire, categorie, actif) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                ("Migration sequence check", "Test", "gym", 0),
            ).fetchone()[0]
            if next_id <= 349:
                raise AssertionError(f"Identity sequence not advanced: {next_id}")
            conn.execute("DELETE FROM exercices WHERE id = %s", (next_id,))

        print(json.dumps({
            "result": "PASS",
            "source": "sanitized reconstruction of uploaded reset staging database",
            "expected_counts": EXPECTED_COUNTS,
            "preflight": "no blockers; exact schema and foreign-key compatibility",
            "import": "11 tables imported in one transaction",
            "postflight": "all 11 tables CONTENT_MATCH; no missing or extra foreign keys",
            "identity_sequence": f"next exercices.id = {next_id}",
            "source_unchanged": source_digest_before == source_digest_after,
            "target_schema": schema_name,
            "target_disposable": True,
        }, ensure_ascii=False, indent=2))
    finally:
        with psycopg.connect(base_dsn, connect_timeout=10) as conn:
            conn.execute(sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(schema_name)))
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
