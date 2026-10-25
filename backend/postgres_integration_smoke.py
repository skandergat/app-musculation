"""Smoke test against a real PostgreSQL server for the optional adapter."""
from datetime import datetime
import secrets

from backend import app as backend


backend.app.config["TESTING"] = True

conn = backend.get_db()
try:
    exercise = conn.execute(
        "SELECT id, nom FROM exercices WHERE actif = 1 ORDER BY id LIMIT 1"
    ).fetchone()
    assert exercise is not None, "Exercise seed did not run"
    exercise_id = exercise["id"]

    # Verify the PostgreSQL schema has the partial unique index and that it
    # preserves inactive historical duplicates while rejecting active ones.
    index = conn.execute(
        """
        SELECT indexdef FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'idx_exercices_actifs_nom_categorie'
        """
    ).fetchone()
    assert index is not None and "UNIQUE INDEX" in index[0].upper(), index

    unique_test_name = "__postgres_unique_smoke_" + secrets.token_hex(8) + "__"
    conn.execute(
        "INSERT INTO exercices (nom, groupe_musculaire, categorie, actif) "
        "VALUES (?, ?, 'gym', 1)",
        (unique_test_name, "Smoke test"),
    )
    conn.commit()
    try:
        conn.execute(
            "INSERT INTO exercices (nom, groupe_musculaire, categorie, actif) "
            "VALUES (?, ?, 'gym', 1)",
            (unique_test_name, "Smoke test duplicate"),
        )
    except backend.DBIntegrityError:
        conn.rollback()
    else:
        raise AssertionError("PostgreSQL accepted duplicate active exercise names")

    conn.execute(
        "INSERT INTO exercices (nom, groupe_musculaire, categorie, actif) "
        "VALUES (?, ?, 'gym', 0)",
        (unique_test_name, "Historical inactive duplicate"),
    )
    conn.commit()
    counts = conn.execute(
        "SELECT COUNT(*), SUM(CASE WHEN actif = 1 THEN 1 ELSE 0 END) "
        "FROM exercices WHERE nom = ? AND categorie = 'gym'",
        (unique_test_name,),
    ).fetchone()
    assert counts[0] == 2 and counts[1] == 1, counts
    conn.execute(
        "DELETE FROM exercices WHERE nom = ? AND categorie = 'gym'",
        (unique_test_name,),
    )
    conn.commit()

    cursor = conn.execute(
        """
        INSERT INTO users (nom, email, password_hash, date_creation, email_verified_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            "PostgreSQL smoke",
            "postgres-smoke@example.test",
            "test-hash",
            datetime.now().isoformat(),
            datetime.now().isoformat(),
        ),
    )
    user_id = cursor.lastrowid
    assert isinstance(user_id, int) and user_id > 0, user_id

    session_cursor = conn.execute(
        "INSERT INTO seances (date_debut, date_fin, user_id) VALUES (?, NULL, ?)",
        (datetime.now().isoformat(), user_id),
    )
    session_id = session_cursor.lastrowid
    assert isinstance(session_id, int) and session_id > 0, session_id

    conn.execute(
        """
        INSERT INTO seance_exercices (seance_id, exercice_id, position, date_ajout)
        VALUES (?, ?, ?, ?)
        """,
        (session_id, exercise_id, 0, datetime.now().isoformat()),
    )
    conn.execute(
        "INSERT INTO series (seance_id, exercice_id, poids, repetitions) VALUES (?, ?, ?, ?)",
        (session_id, exercise_id, 20.0, 10),
    )
    conn.commit()

    fetched = conn.execute(
        """
        SELECT users.id, users.email, seances.id AS seance_id
        FROM users JOIN seances ON seances.user_id = users.id
        WHERE users.id = ?
        """,
        (user_id,),
    ).fetchone()
    assert fetched["id"] == user_id
    assert fetched[0] == user_id
    assert fetched["email"] == "postgres-smoke@example.test"
    assert fetched["seance_id"] == session_id

    conn.execute("DELETE FROM series WHERE seance_id = ?", (session_id,))
    conn.execute("DELETE FROM seance_exercices WHERE seance_id = ?", (session_id,))
    conn.execute("DELETE FROM seances WHERE id = ?", (session_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
finally:
    conn.close()

print("LIFTELY PostgreSQL integration smoke test: OK")
