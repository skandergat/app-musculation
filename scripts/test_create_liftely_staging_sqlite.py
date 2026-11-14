import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts import create_liftely_staging_sqlite as staging


class CreateLiftelyStagingSQLiteTests(unittest.TestCase):
    def test_creates_verified_catalogue_only_database(self):
        with tempfile.TemporaryDirectory(prefix="liftely-staging-test-") as directory:
            output = Path(directory) / "staging.sqlite"
            counts = staging.create_database(output)

            self.assertEqual(counts, staging.EXPECTED_COUNTS)
            self.assertTrue(output.is_file())
            with sqlite3.connect(output) as conn:
                self.assertEqual(
                    conn.execute("PRAGMA integrity_check").fetchone()[0],
                    "ok",
                )
                self.assertEqual(
                    conn.execute("SELECT COUNT(*) FROM exercices").fetchone()[0],
                    349,
                )
                self.assertEqual(
                    conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
                    0,
                )

    def test_refuses_to_overwrite_existing_file(self):
        with tempfile.TemporaryDirectory(prefix="liftely-staging-test-") as directory:
            output = Path(directory) / "existing.sqlite"
            output.write_bytes(b"do not overwrite")
            with self.assertRaises(FileExistsError):
                staging.create_database(output)
            self.assertEqual(output.read_bytes(), b"do not overwrite")

    def test_refuses_output_inside_repository(self):
        output = staging.ROOT / "staging-should-not-be-created.sqlite"
        with self.assertRaises(ValueError):
            staging.create_database(output)
        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
