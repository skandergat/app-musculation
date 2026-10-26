#!/usr/bin/env python3
"""Safely reset LIFTELY user data on a disposable copy of the backend SQLite DB.

Default mode is read-only: it audits the source and prints the planned actions.
With --apply-to-copy, it copies backend/musculation.db to a NEW output file and
clears user-owned data only in that copy. It never modifies the source database
and deliberately refuses to overwrite an existing output file.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "backend" / "musculation.db"
DEFAULT_OUTPUT = ROOT / "migration_reset_test.db"

REQUIRED_TABLES = (
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
USER_DATA_TABLES = (
    "series",
    "seance_exercices",
    "template_exercices",
    "templates",
    "seances",
    "sessions",
    "auth_action_tokens",
    "users",
    "auth_mail_limits",
)


def connect_read_only(path: Path) -> sqlite3.Connection:
    uri = path.resolve().as_uri() + "?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def table_names(connection: sqlite3.Connection) -> set[str]:
    return {
        row["name"]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }


def schema_snapshot(connection: sqlite3.Connection) -> tuple:
    rows = connection.execute(
        """
        SELECT type, name, tbl_name, COALESCE(sql, '')
        FROM sqlite_master
        WHERE name NOT LIKE 'sqlite_%'
        ORDER BY type, name, tbl_name
        """
    ).fetchall()
    return tuple(tuple(row) for row in rows)


def exercises_fingerprint(connection: sqlite3.Connection) -> str:
    rows = connection.execute(
        "SELECT * FROM exercices ORDER BY id"
    ).fetchall()
    payload = json.dumps(
        [tuple(row) for row in rows],
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def counts(connection: sqlite3.Connection, tables: tuple[str, ...]) -> dict[str, int]:
    return {
        table: connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        for table in tables
    }


def validate_schema(connection: sqlite3.Connection) -> None:
    missing = sorted(set(REQUIRED_TABLES) - table_names(connection))
    if missing:
        raise RuntimeError("Tables requises absentes : " + ", ".join(missing))

    exercise_count = connection.execute(
        "SELECT COUNT(*) FROM exercices"
    ).fetchone()[0]
    if exercise_count == 0:
        raise RuntimeError("Le catalogue exercices est vide : arrêt de sécurité.")

    index_rows = connection.execute("PRAGMA index_list('seances')").fetchall()
    active_index = next(
        (row for row in index_rows if row["name"] == "idx_seances_active_user"),
        None,
    )
    if active_index is None:
        raise RuntimeError(
            "Index idx_seances_active_user absent : arrêt sans modification."
        )
    if not active_index["unique"] or not active_index["partial"]:
        raise RuntimeError(
            "idx_seances_active_user n'est pas unique et partiel : arrêt."
        )

    index_sql_row = connection.execute(
        """
        SELECT sql FROM sqlite_master
        WHERE type = 'index' AND name = 'idx_seances_active_user'
        """
    ).fetchone()
    index_sql = (index_sql_row["sql"] or "").lower() if index_sql_row else ""
    normalized_sql = " ".join(index_sql.split())
    if "where date_fin is null" not in normalized_sql or "user_id is not null" not in normalized_sql:
        raise RuntimeError(
            "La définition de idx_seances_active_user ne correspond pas à celle attendue."
        )


def validate_database(connection: sqlite3.Connection) -> None:
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    foreign_key_errors = connection.execute("PRAGMA foreign_key_check").fetchall()
    if integrity != "ok":
        raise RuntimeError(f"PRAGMA integrity_check a échoué : {integrity}")
    if foreign_key_errors:
        raise RuntimeError(
            f"PRAGMA foreign_key_check détecte {len(foreign_key_errors)} erreur(s)."
        )


def reset_copy(output_path: Path) -> None:
    if output_path.exists():
        raise RuntimeError(
            f"Le fichier de sortie existe déjà : {output_path}. "
            "Choisis un autre nom ou examine ce fichier manuellement ; aucun écrasement."
        )

    shutil.copy2(DEFAULT_SOURCE, output_path)
    connection = sqlite3.connect(output_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")

    try:
        validate_schema(connection)
        validate_database(connection)
        schema_before = schema_snapshot(connection)
        exercise_hash_before = exercises_fingerprint(connection)
        exercise_count_before = connection.execute(
            "SELECT COUNT(*) FROM exercices"
        ).fetchone()[0]
        before = counts(connection, USER_DATA_TABLES)

        connection.execute("BEGIN IMMEDIATE")
        for table in USER_DATA_TABLES:
            connection.execute(f'DELETE FROM "{table}"')

        validate_database(connection)

        remaining = counts(connection, USER_DATA_TABLES)
        not_empty = {table: count for table, count in remaining.items() if count != 0}
        if not_empty:
            raise RuntimeError(
                "Certaines tables utilisateur ne sont pas vides : "
                + repr(not_empty)
            )

        exercise_count_after = connection.execute(
            "SELECT COUNT(*) FROM exercices"
        ).fetchone()[0]
        exercise_hash_after = exercises_fingerprint(connection)
        if exercise_count_after != exercise_count_before or exercise_hash_after != exercise_hash_before:
            raise RuntimeError(
                "Le catalogue d'exercices a changé pendant la réinitialisation."
            )
        if schema_snapshot(connection) != schema_before:
            raise RuntimeError(
                "Le schéma (tables/index/contraintes) a changé pendant la réinitialisation."
            )

        connection.commit()

        # Re-check after commit as an independent final validation.
        validate_database(connection)
        print("RÉINITIALISATION DE LA COPIE TERMINÉE.")
        print(f"Copie test : {output_path}")
        print("L'original backend/musculation.db n'a pas été modifié.")
        print(f"Exercices conservés : {exercise_count_after}")
        print("Lignes avant -> après :")
        for table in USER_DATA_TABLES:
            print(f"  {table}: {before[table]} -> {remaining[table]}")
        print("Schéma et index : inchangés.")
        print("Intégrité SQLite : ok ; erreurs de clés étrangères : 0.")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Auditer ou réinitialiser les données utilisateur sur une copie SQLite."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Base backend source (lecture seule).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Nom du nouveau fichier de copie (utilisé avec --apply-to-copy).",
    )
    parser.add_argument(
        "--apply-to-copy",
        action="store_true",
        help="Créer une NOUVELLE copie puis vider les données utilisateur de cette copie uniquement.",
    )
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()

    if not source.is_file():
        print(f"ERREUR : base source introuvable : {source}", file=sys.stderr)
        return 2
    if source == output:
        print("ERREUR : la source et la sortie ne peuvent pas être le même fichier.", file=sys.stderr)
        return 2

    try:
        with connect_read_only(source) as connection:
            validate_schema(connection)
            validate_database(connection)
            initial = counts(connection, USER_DATA_TABLES)
            exercise_count = connection.execute(
                "SELECT COUNT(*) FROM exercices"
            ).fetchone()[0]
            print("Précontrôle réussi (source ouverte en lecture seule).")
            print(f"Source : {source}")
            print(f"Exercices qui seront conservés : {exercise_count}")
            print("Données utilisateur qui seraient vidées :")
            for table in USER_DATA_TABLES:
                print(f"  {table}: {initial[table]} ligne(s)")

        if not args.apply_to_copy:
            print("\nMode audit : aucune copie créée et aucune donnée modifiée.")
            print("Pour tester sur une copie, relance avec --apply-to-copy.")
            return 0

        output.parent.mkdir(parents=True, exist_ok=True)
        # reset_copy uses DEFAULT_SOURCE; support custom --source safely by
        # copying the selected source explicitly before applying the same checks.
        if source != DEFAULT_SOURCE.resolve():
            if output.exists():
                raise RuntimeError(
                    f"Le fichier de sortie existe déjà : {output}. Aucun écrasement."
                )
            shutil.copy2(source, output)
            _reset_existing_copy(output)
        else:
            reset_copy(output)
        return 0
    except (OSError, sqlite3.Error, RuntimeError) as exc:
        print(f"ÉCHEC SÉCURISÉ : {exc}", file=sys.stderr)
        return 1


def _reset_existing_copy(output_path: Path) -> None:
    """Reset a copy already created from a custom source path."""
    connection = sqlite3.connect(output_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    try:
        validate_schema(connection)
        validate_database(connection)
        schema_before = schema_snapshot(connection)
        exercise_hash_before = exercises_fingerprint(connection)
        exercise_count_before = connection.execute("SELECT COUNT(*) FROM exercices").fetchone()[0]
        before = counts(connection, USER_DATA_TABLES)

        connection.execute("BEGIN IMMEDIATE")
        for table in USER_DATA_TABLES:
            connection.execute(f'DELETE FROM "{table}"')
        validate_database(connection)

        remaining = counts(connection, USER_DATA_TABLES)
        not_empty = {table: count for table, count in remaining.items() if count != 0}
        if not_empty:
            raise RuntimeError("Tables utilisateur non vides après suppression : " + repr(not_empty))
        exercise_count_after = connection.execute("SELECT COUNT(*) FROM exercices").fetchone()[0]
        if exercise_count_after != exercise_count_before or exercises_fingerprint(connection) != exercise_hash_before:
            raise RuntimeError("Le catalogue d'exercices a changé.")
        if schema_snapshot(connection) != schema_before:
            raise RuntimeError("Le schéma a changé.")
        connection.commit()
        validate_database(connection)
        print("RÉINITIALISATION DE LA COPIE TERMINÉE.")
        print(f"Copie test : {output_path}")
        print("La source n'a pas été modifiée.")
        print(f"Exercices conservés : {exercise_count_after}")
        print("Lignes avant -> après :")
        for table in USER_DATA_TABLES:
            print(f"  {table}: {before[table]} -> {remaining[table]}")
        print("Schéma et index : inchangés.")
        print("Intégrité SQLite : ok ; erreurs de clés étrangères : 0.")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
