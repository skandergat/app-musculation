"""Tests d'intégration isolés pour l'unicité du catalogue d'exercices.

Le backend est importé dans un sous-processus pointant vers une base SQLite
temporaire. Aucune base de développement ou de production n'est touchée.
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import unittest
from tempfile import TemporaryDirectory


class ExerciseCatalogUniquenessTests(unittest.TestCase):
    def test_initializer_is_repeatable_and_active_catalog_is_unique(self):
        with TemporaryDirectory(prefix="liftely-catalog-test-") as temp_dir:
            db_path = Path(temp_dir) / "catalog-test.sqlite"
            env = os.environ.copy()
            env["LIFTELY_DB_PATH"] = str(db_path)
            env.pop("LIFTELY_DATABASE_URL", None)
            script = r"""
import importlib
import sqlite3

backend = importlib.import_module("backend.app")
backend.assurer_base()
conn = sqlite3.connect(backend.DB_PATH)
try:
    index = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='index' "
        "AND name='idx_exercices_actifs_nom_categorie'"
    ).fetchone()
    assert index and "UNIQUE INDEX" in index[0].upper(), index
    assert "WHERE actif = 1" in index[0], index[0]

    duplicates = conn.execute(
        "SELECT nom, categorie, COUNT(*) FROM exercices "
        "WHERE actif = 1 GROUP BY nom, categorie HAVING COUNT(*) > 1"
    ).fetchall()
    assert not duplicates, duplicates

    conn.execute(
        "INSERT INTO exercices (nom, categorie, actif) VALUES (?, ?, 1)",
        ("__liftely_unique_test__", "gym"),
    )
    conn.commit()
    try:
        conn.execute(
            "INSERT INTO exercices (nom, categorie, actif) VALUES (?, ?, 1)",
            ("__liftely_unique_test__", "gym"),
        )
    except sqlite3.IntegrityError:
        conn.rollback()
    else:
        raise AssertionError("L'index doit refuser deux entrées actives identiques")

    # Les doublons historiques inactifs restent permis et ne sont pas supprimés.
    conn.execute(
        "INSERT INTO exercices (nom, categorie, actif) VALUES (?, ?, 0)",
        ("__liftely_unique_test__", "gym"),
    )
    conn.commit()
finally:
    conn.close()
"""
            result = subprocess.run(
                [sys.executable, "-c", script],
                cwd=Path(__file__).resolve().parents[1],
                env=env,
                capture_output=True,
                text=True,
                timeout=90,
            )
            self.assertEqual(
                result.returncode,
                0,
                msg=f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}",
            )


if __name__ == "__main__":
    unittest.main()
