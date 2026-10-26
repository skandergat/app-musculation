"""Regression tests for the copy-only SQLite user-data reset utility."""
from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts import reset_liftely_user_data_copy as reset


def create_database(path: Path, *, wal: bool = False) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys = ON")
    if wal:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA wal_autocheckpoint = 0")

    connection.executescript(
        """
        CREATE TABLE exercices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            groupe_musculaire TEXT,
            categorie TEXT NOT NULL DEFAULT 'gym',
            actif INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            date_creation TEXT NOT NULL,
            email_verified_at TEXT
        );
        CREATE TABLE sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            date_creation TEXT NOT NULL,
            date_expiration TEXT NOT NULL
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
        CREATE INDEX idx_auth_action_user_purpose
            ON auth_action_tokens(user_id, purpose, date_expiration);
        CREATE TABLE auth_mail_limits (
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
            UNIQUE(template_id, exercice_id)
        );
        CREATE INDEX idx_template_exercices_template
            ON template_exercices(template_id, position);
        CREATE TABLE seances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_debut TEXT NOT NULL,
            date_fin TEXT,
            user_id INTEGER
        );
        CREATE UNIQUE INDEX idx_seances_active_user
            ON seances(user_id)
            WHERE date_fin IS NULL AND user_id IS NOT NULL;
        CREATE TABLE series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seance_id INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
            exercice_id INTEGER NOT NULL REFERENCES exercices(id),
            poids REAL NOT NULL,
            repetitions INTEGER NOT NULL
        );
        CREATE TABLE seance_exercices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seance_id INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
            exercice_id INTEGER NOT NULL REFERENCES exercices(id),
            position INTEGER NOT NULL DEFAULT 0,
            UNIQUE(seance_id, exercice_id)
        );
        """
    )
    connection.execute(
        "INSERT INTO exercices (id, nom, groupe_musculaire, categorie, actif) "
        "VALUES (1, 'Pompes', 'pectoraux', 'calisthenics', 1)"
    )
    connection.execute(
        "INSERT INTO users (id, nom, email, password_hash, date_creation, email_verified_at) "
        "VALUES (1, 'Test', 'test@example.test', 'hashed', '2026-01-01', '2026-01-01')"
    )
    connection.execute(
        "INSERT INTO sessions VALUES ('session-hash', 1, '2026-01-01', '2027-01-01')"
    )
    connection.execute(
        "INSERT INTO auth_action_tokens VALUES "
        "('action-hash', 1, 'verify_email', '2026-01-01', '2027-01-01', NULL)"
    )
    connection.execute(
        "INSERT INTO auth_mail_limits VALUES ('limit-hash', '2026-01-01', 1)"
    )
    connection.execute(
        "INSERT INTO templates VALUES (1, 1, 'Push', '2026-01-01', '2026-01-01')"
    )
    connection.execute("INSERT INTO template_exercices VALUES (1, 1, 1, 0)")
    connection.execute(
        "INSERT INTO seances VALUES (1, '2026-01-01', NULL, 1)"
    )
    connection.execute("INSERT INTO seance_exercices VALUES (1, 1, 1, 0)")
    connection.execute("INSERT INTO series VALUES (1, 1, 1, 20, 10)")
    connection.commit()
    return connection


class ResetUserDataCopyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source.db"
        self.output = self.root / "output.db"
        self.source_connection = create_database(self.source)

    def tearDown(self) -> None:
        self.source_connection.close()
        self.temp.cleanup()

    def test_clears_only_copy_and_preserves_catalogue_and_schema(self) -> None:
        source_schema = reset.schema_snapshot(self.source_connection)
        source_fingerprint = reset.exercises_fingerprint(self.source_connection)
        source_counts = reset.counts(self.source_connection, reset.USER_DATA_TABLES)

        reset.reset_copy(self.source, self.output)

        with reset.connect_read_only(self.output) as copied:
            self.assertEqual(reset.schema_snapshot(copied), source_schema)
            self.assertEqual(reset.exercises_fingerprint(copied), source_fingerprint)
            self.assertEqual(copied.execute("SELECT COUNT(*) FROM exercices").fetchone()[0], 1)
            self.assertTrue(all(value == 0 for value in reset.counts(copied, reset.USER_DATA_TABLES).values()))
            self.assertEqual(copied.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(copied.execute("PRAGMA foreign_key_check").fetchall(), [])

        self.assertEqual(reset.counts(self.source_connection, reset.USER_DATA_TABLES), source_counts)
        self.assertEqual(reset.exercises_fingerprint(self.source_connection), source_fingerprint)

    def test_existing_output_is_never_overwritten(self) -> None:
        self.output.write_bytes(b"keep this exact content")
        with self.assertRaisesRegex(RuntimeError, "existe déjà"):
            reset.reset_copy(self.source, self.output)
        self.assertEqual(self.output.read_bytes(), b"keep this exact content")

    def test_failed_validation_removes_incomplete_output(self) -> None:
        invalid_source = self.root / "invalid.db"
        with sqlite3.connect(invalid_source) as connection:
            connection.execute("CREATE TABLE unrelated (id INTEGER PRIMARY KEY)")

        invalid_output = self.root / "invalid-output.db"
        with self.assertRaisesRegex(RuntimeError, "Tables requises absentes"):
            reset.reset_copy(invalid_source, invalid_output)
        self.assertFalse(invalid_output.exists())

    def test_backup_includes_committed_wal_data(self) -> None:
        self.source_connection.close()
        self.source_connection = create_database(self.source, wal=True)
        self.source_connection.execute(
            "INSERT INTO exercices (nom, groupe_musculaire, categorie, actif) "
            "VALUES ('Tractions', 'dos', 'calisthenics', 1)"
        )
        self.source_connection.commit()

        wal_path = Path(str(self.source) + "-wal")
        self.assertTrue(wal_path.exists())
        reset.reset_copy(self.source, self.output)

        with reset.connect_read_only(self.output) as copied:
            names = [
                row[0] for row in copied.execute(
                    "SELECT nom FROM exercices ORDER BY id"
                ).fetchall()
            ]
            self.assertEqual(names, ["Pompes", "Tractions"])


if __name__ == "__main__":
    unittest.main()
