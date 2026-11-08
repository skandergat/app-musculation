"""End-to-end tests for the SQLite -> PostgreSQL importer on disposable schemas.

This script creates two temporary PostgreSQL schemas: one for a successful
import and one where a deliberate unique-index violation must roll back every
insert. It never connects to Supabase unless the caller explicitly supplies
that DSN; CI uses its isolated PostgreSQL service.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import uuid

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_FILE = ROOT / "backend" / "postgres_schema.sql"
IMPORTER = ROOT / "backend" / "migrate_sqlite_to_postgres.py"
TABLES = (
    "users", "exercices", "auth_mail_limits", "auth_login_limits", "sessions",
    "auth_action_tokens", "templates", "seances",
    "template_exercices", "series", "seance_exercices",
)


def build_sqlite_fixture(path: Path, duplicate_exercise: bool = False) -> None:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            date_creation TEXT NOT NULL,
            email_verified_at TEXT
        );
        CREATE TABLE exercices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            groupe_musculaire TEXT,
            categorie TEXT NOT NULL DEFAULT 'gym',
            actif INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            date_creation TEXT NOT NULL,
            date_expiration TEXT
        );
        CREATE TABLE auth_action_tokens (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            purpose TEXT NOT NULL CHECK (
                purpose IN ('verify_email', 'password_reset', 'delete_account')
            ),
            date_creation TEXT NOT NULL,
            date_expiration TEXT NOT NULL,
            date_utilisation TEXT
        );
        CREATE TABLE auth_mail_limits (
            key_hash TEXT PRIMARY KEY,
            window_start TEXT NOT NULL,
            request_count INTEGER NOT NULL
        );
        CREATE TABLE auth_login_limits (
            key_hash TEXT PRIMARY KEY,
            window_start TEXT NOT NULL,
            request_count INTEGER NOT NULL
        );
        CREATE TABLE templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            nom TEXT NOT NULL,
            date_creation TEXT NOT NULL,
            date_modification TEXT NOT NULL
        );
        CREATE TABLE template_exercices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
            exercice_id INTEGER NOT NULL REFERENCES exercices(id),
            position INTEGER NOT NULL DEFAULT 0,
            nombre_series INTEGER NOT NULL DEFAULT 3,
            poids_prevu REAL NOT NULL DEFAULT 0,
            repetitions_prevues INTEGER NOT NULL DEFAULT 10
        );
        CREATE TABLE seances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_debut TEXT NOT NULL,
            date_fin TEXT,
            user_id INTEGER
        );
        CREATE TABLE series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seance_id INTEGER NOT NULL REFERENCES seances(id),
            exercice_id INTEGER NOT NULL REFERENCES exercices(id),
            poids REAL,
            repetitions INTEGER
        );
        CREATE TABLE seance_exercices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seance_id INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
            exercice_id INTEGER NOT NULL REFERENCES exercices(id),
            position INTEGER NOT NULL DEFAULT 0,
            date_ajout TEXT NOT NULL,
            nombre_series_prevu INTEGER NOT NULL DEFAULT 1,
            poids_prevu REAL NOT NULL DEFAULT 0,
            repetitions_prevues INTEGER NOT NULL DEFAULT 10,
            UNIQUE(seance_id, exercice_id)
        );
        CREATE INDEX idx_auth_action_user_purpose
            ON auth_action_tokens(user_id, purpose, date_expiration);
        CREATE INDEX idx_template_exercices_template
            ON template_exercices(template_id, position);
        CREATE UNIQUE INDEX idx_seances_active_user
            ON seances(user_id)
            WHERE date_fin IS NULL AND user_id IS NOT NULL;
        CREATE INDEX idx_seance_exercices_seance
            ON seance_exercices(seance_id, position);
        """
    )
    if not duplicate_exercise:
        conn.execute(
            "CREATE UNIQUE INDEX idx_template_exercices_unique "
            "ON template_exercices(template_id, exercice_id)"
        )
    conn.execute(
        "INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)",
        (10, "Import Test", "import@example.test", "hash", "2026-01-01", "2026-01-01"),
    )
    conn.execute(
        "INSERT INTO exercices VALUES (?, ?, ?, ?, ?)",
        (20, "Push-up", "Chest", "calisthenics", 1),
    )
    conn.execute(
        "INSERT INTO sessions VALUES (?, ?, ?, ?)",
        ("session-hash", 10, "2026-01-01", "2026-02-01"),
    )
    conn.execute(
        "INSERT INTO auth_action_tokens VALUES (?, ?, ?, ?, ?, ?)",
        ("action-hash", 10, "verify_email", "2026-01-01", "2026-01-02", None),
    )
    conn.execute(
        "INSERT INTO auth_mail_limits VALUES (?, ?, ?)",
        ("mail-hash", "2026-01-01", 1),
    )
    conn.execute(
        "INSERT INTO templates VALUES (?, ?, ?, ?, ?)",
        (30, 10, "Push day", "2026-01-01", "2026-01-01"),
    )
    conn.execute(
        "INSERT INTO seances VALUES (?, ?, ?, ?)",
        (40, "2026-01-01", "2026-01-01T01:00:00", 10),
    )
    conn.execute(
        """
        INSERT INTO template_exercices
            (id, template_id, exercice_id, position, nombre_series, poids_prevu, repetitions_prevues)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (50, 30, 20, 0, 3, 0, 10),
    )
    if duplicate_exercise:
        conn.execute(
            """
            INSERT INTO template_exercices
                (id, template_id, exercice_id, position, nombre_series, poids_prevu, repetitions_prevues)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (51, 30, 20, 1, 3, 0, 10),
        )
    conn.execute(
        "INSERT INTO series VALUES (?, ?, ?, ?, ?)",
        (60, 40, 20, 20.5, 10),
    )
    conn.execute(
        """
        INSERT INTO seance_exercices
            (id, seance_id, exercice_id, position, date_ajout,
             nombre_series_prevu, poids_prevu, repetitions_prevues)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (70, 40, 20, 0, "2026-01-01", 1, 0, 10),
    )
    conn.commit()
    conn.close()


def source_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def create_target_schema(base_dsn: str, schema_name: str) -> str:
    with psycopg.connect(base_dsn, connect_timeout=10) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema_name)))
    target_dsn = make_conninfo(base_dsn, options=f"-c search_path={schema_name}")
    with psycopg.connect(target_dsn, connect_timeout=10) as conn:
        conn.execute(SCHEMA_FILE.read_text(encoding="utf-8"))
    return target_dsn


def run_preflight(source: Path, target_dsn: str, schema_name: str) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["LIFTELY_DATABASE_URL"] = target_dsn
    env.pop("SUPABASE_DB_URL", None)
    env.pop("DATABASE_URL", None)
    return subprocess.run(
        [
            sys.executable, str(ROOT / "backend" / "migration_preflight.py"),
            "--sqlite", str(source),
            "--schema", schema_name,
        ],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )


def run_import(source: Path, target_dsn: str) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["LIFTELY_DATABASE_URL"] = target_dsn
    env.pop("SUPABASE_DB_URL", None)
    env.pop("DATABASE_URL", None)
    return subprocess.run(
        [
            sys.executable, str(IMPORTER),
            "--source", str(source),
            "--schema", str(SCHEMA_FILE),
        ],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )


def assert_empty_target(target_dsn: str) -> None:
    with psycopg.connect(target_dsn, connect_timeout=10) as conn:
        for table in TABLES:
            count = conn.execute(
                sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table))
            ).fetchone()[0]
            assert count == 0, (table, count)


def main() -> None:
    base_dsn = (
        os.getenv("LIFTELY_DATABASE_URL", "").strip()
        or os.getenv("SUPABASE_DB_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )
    if not base_dsn.startswith(("postgres://", "postgresql://")):
        raise SystemExit("An isolated PostgreSQL DSN is required for this test.")

    temp_dir = Path(os.getenv("RUNNER_TEMP", "/tmp")) / f"liftely-import-{uuid.uuid4().hex}"
    temp_dir.mkdir(parents=True, exist_ok=False)
    schemas: list[str] = []
    try:
        valid_source = temp_dir / "valid.sqlite"
        valid_hash_before = None
        build_sqlite_fixture(valid_source)
        valid_hash_before = source_digest(valid_source)

        success_schema = f"liftely_import_ok_{uuid.uuid4().hex[:12]}"
        schemas.append(success_schema)
        success_dsn = create_target_schema(base_dsn, success_schema)
        preflight = run_preflight(valid_source, success_dsn, success_schema)
        assert preflight.returncode == 0, (preflight.stdout, preflight.stderr)
        preflight_report = json.loads(preflight.stdout)
        assert preflight_report["blockers"] == [], preflight_report["blockers"]
        assert preflight_report["result"] == "REVIEW_REQUIRED"
        result = run_import(valid_source, success_dsn)
        assert result.returncode == 0, (result.stdout, result.stderr)
        with psycopg.connect(success_dsn, connect_timeout=10) as conn:
            expected_counts = {
                "users": 1, "exercices": 1, "auth_mail_limits": 1,
                "auth_login_limits": 0,
                "sessions": 1, "auth_action_tokens": 1, "templates": 1,
                "seances": 1, "template_exercices": 1, "series": 1,
                "seance_exercices": 1,
            }
            for table, expected in expected_counts.items():
                actual = conn.execute(
                    sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table))
                ).fetchone()[0]
                assert actual == expected, (table, expected, actual)
            new_user_id = conn.execute(
                """
                INSERT INTO users (nom, email, password_hash, date_creation)
                VALUES (%s, %s, %s, %s) RETURNING id
                """,
                ("After import", "after-import@example.test", "hash", "2026-01-02"),
            ).fetchone()[0]
            assert new_user_id > 10, new_user_id
        assert source_digest(valid_source) == valid_hash_before, "SQLite source was modified"

        invalid_source = temp_dir / "duplicate.sqlite"
        build_sqlite_fixture(invalid_source, duplicate_exercise=True)
        invalid_schema = f"liftely_import_rollback_{uuid.uuid4().hex[:12]}"
        schemas.append(invalid_schema)
        invalid_dsn = create_target_schema(base_dsn, invalid_schema)
        failed = run_import(invalid_source, invalid_dsn)
        assert failed.returncode != 0, (failed.stdout, failed.stderr)
        assert_empty_target(invalid_dsn)

        print("SQLite -> PostgreSQL end-to-end import tests passed.")
        print("Validated: full table import, identity sequence reset, source immutability, transaction rollback.")
    finally:
        with psycopg.connect(base_dsn, connect_timeout=10) as conn:
            for schema_name in schemas:
                conn.execute(
                    sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(
                        sql.Identifier(schema_name)
                    )
                )
        for child in temp_dir.iterdir():
            child.unlink()
        temp_dir.rmdir()


if __name__ == "__main__":
    main()
