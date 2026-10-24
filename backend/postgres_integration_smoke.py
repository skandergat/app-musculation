"""Smoke test against a real PostgreSQL server for the optional adapter."""
from datetime import datetime

from backend import app as backend


backend.app.config["TESTING"] = True

conn = backend.get_db()
try:
    exercise = conn.execute(
        "SELECT id, nom FROM exercices WHERE actif = 1 ORDER BY id LIMIT 1"
    ).fetchone()
    assert exercise is not None, "Exercise seed did not run"
    exercise_id = exercise["id"]

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
