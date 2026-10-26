"""Smoke tests for the PostgreSQL compatibility adapter (CI uses an isolated DB)."""
from __future__ import annotations

import os
import uuid

from backend.db_compat import connect_database

dsn = os.environ.get("LIFTELY_DATABASE_URL", "").strip()
assert dsn.startswith(("postgres://", "postgresql://")), "CI must provide an isolated PostgreSQL DSN"

conn = connect_database(":memory:")
try:
    # Placeholder translation must not alter question marks in quoted text/comments.
    literal = conn.execute("SELECT '?' AS literal_value, %s AS parameter_value -- ? ignored\n", ("ok",)).fetchone()
    assert literal["literal_value"] == "?"
    assert literal["parameter_value"] == "ok"

    # SQLite PRAGMA compatibility and both named/indexed row access.
    columns = conn.execute("PRAGMA table_info(users)").fetchall()
    assert columns and any(row["name"] == "email" for row in columns)
    email_column = next(row for row in columns if row["name"] == "email")
    assert email_column[1] == "email"

    # INSERT lastrowid compatibility, using a unique throwaway user.
    email = f"postgres-adapter-{uuid.uuid4().hex}@example.test"
    cursor = conn.execute(
        "INSERT INTO users (nom, email, password_hash, date_creation, email_verified_at) "
        "VALUES (?, ?, ?, ?, ?)",
        ("CI PostgreSQL", email, "test-hash", "2026-01-01T00:00:00", "2026-01-01T00:00:00"),
    )
    user_id = cursor.lastrowid
    assert isinstance(user_id, int) and user_id > 0
    row = conn.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    assert row["email"] == email and row[0] == user_id

    # The SQLite BEGIN IMMEDIATE lock shim must execute without SQL errors.
    conn.execute("BEGIN IMMEDIATE")
    conn.rollback()

    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    print("PostgreSQL adapter smoke tests passed.")
finally:
    conn.close()
