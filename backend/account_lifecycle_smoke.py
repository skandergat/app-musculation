from __future__ import annotations

import os
import sqlite3
import tempfile
from urllib.parse import parse_qs, urlsplit

TEMP_DIR = tempfile.TemporaryDirectory()
DATABASE = os.path.join(TEMP_DIR.name, "legacy-and-lifecycle.db")
os.environ["LIFTELY_DB_PATH"] = DATABASE

legacy = sqlite3.connect(DATABASE)
legacy.execute("""
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        date_creation TEXT NOT NULL
    )
""")
legacy.execute(
    "INSERT INTO users (nom, email, password_hash, date_creation) "
    "VALUES (?, ?, ?, ?)",
    ("Legacy user", "legacy@example.test", "legacy-hash", "2020-01-01T00:00:00"),
)
legacy.commit()
legacy.close()

from backend import app as backend  # noqa: E402

backend.app.config["TESTING"] = True
client = backend.app.test_client()


def token_for(subject: str, email: str) -> str:
    matches = [
        item for item in backend.app.config["TEST_EMAIL_OUTBOX"]
        if item["to"] == email and item["subject"] == subject
    ]
    assert matches, f"No test email for {email!r} with subject {subject!r}"
    url = matches[-1]["body"].splitlines()[-1]
    token = parse_qs(urlsplit(url).fragment).get("token", [""])[0]
    assert token
    return token


def assert_account_rows_removed(email: str) -> None:
    conn = sqlite3.connect(DATABASE)
    user_id = conn.execute(
        "SELECT id FROM users WHERE email = ?", (email,)
    ).fetchone()
    assert user_id is None, user_id
    for table in (
        "sessions",
        "seances",
        "seance_exercices",
        "series",
        "templates",
        "template_exercices",
        "auth_action_tokens",
    ):
        remaining = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        assert remaining == 0, (table, remaining)
    email_limit = conn.execute(
        "SELECT COUNT(*) FROM auth_mail_limits WHERE key_hash = ?",
        (backend.hash_token("email:" + email),),
    ).fetchone()[0]
    assert email_limit == 0, email_limit
    conn.close()


# Existing users are migrated as verified so deployment does not lock them out.
conn = backend.get_db()
legacy_user = conn.execute(
    "SELECT email_verified_at FROM users WHERE email = 'legacy@example.test'"
).fetchone()
assert legacy_user and legacy_user["email_verified_at"] == "2020-01-01T00:00:00"
conn.close()

# Public legal and account-deletion pages must load without authentication.
privacy = client.get("/privacy")
assert privacy.status_code == 200
assert "Configuration requise avant le lancement".encode() in privacy.data
assert client.get("/account-deletion").status_code == 200

email = "lifecycle@example.test"
registered = client.post(
    "/auth/register",
    json={"nom": "Lifecycle", "email": email, "password": "OldPassword123!"},
)
assert registered.status_code == 201, registered.data
assert "token" not in registered.get_json()

unverified_login = client.post(
    "/auth/login", json={"email": email, "password": "OldPassword123!"}
)
assert unverified_login.status_code == 403, unverified_login.data
assert unverified_login.get_json()["code"] == "email_not_verified"

verify_token = token_for("Confirme ton adresse e-mail LIFTELY", email)
verify_page = client.get("/email/verify")
assert verify_page.status_code == 200
assert verify_page.headers["Cache-Control"] == "no-store"
assert verify_page.headers["Referrer-Policy"] == "no-referrer"
verified = client.post("/auth/verify-email", json={"token": verify_token})
assert verified.status_code == 200, verified.data
assert client.post("/auth/verify-email", json={"token": verify_token}).status_code == 400

login = client.post(
    "/auth/login", json={"email": email, "password": "OldPassword123!"}
)
assert login.status_code == 200, login.data
old_token = login.get_json()["token"]
old_headers = {"Authorization": "Bearer " + old_token}

# Reset requests do not reveal whether an address has an account.
unknown_reset = client.post(
    "/auth/password-reset-request", json={"email": "missing@example.test"}
)
known_reset = client.post("/auth/password-reset-request", json={"email": email})
assert unknown_reset.status_code == known_reset.status_code == 202
assert unknown_reset.get_json() == known_reset.get_json()

reset_token = token_for("Réinitialisation du mot de passe LIFTELY", email)
new_password = client.post(
    "/auth/password-reset",
    json={"token": reset_token, "password": "NewPassword456!"},
)
assert new_password.status_code == 200, new_password.data
assert client.get("/auth/me", headers=old_headers).status_code == 401
assert client.post(
    "/auth/password-reset",
    json={"token": reset_token, "password": "OtherPassword789!"},
).status_code == 400
assert client.post(
    "/auth/login", json={"email": email, "password": "OldPassword123!"}
).status_code == 401

login = client.post(
    "/auth/login", json={"email": email, "password": "NewPassword456!"}
)
assert login.status_code == 200, login.data
headers = {"Authorization": "Bearer " + login.get_json()["token"]}

# Put real user data in each collection before in-app deletion.
session = client.post("/seances", headers=headers)
assert session.status_code == 201, session.data
session_id = session.get_json()["seance_id"]
conn = backend.get_db()
exercise_id = conn.execute(
    "SELECT id FROM exercices WHERE actif = 1 ORDER BY id LIMIT 1"
).fetchone()["id"]
conn.close()
assert client.post(
    f"/seances/{session_id}/exercices",
    headers=headers,
    json={"exercice_id": exercise_id},
).status_code == 201
assert client.post(
    f"/seances/{session_id}/series",
    headers=headers,
    json={"exercice_id": exercise_id, "poids": 20, "repetitions": 10},
).status_code == 201
template = client.post(
    "/templates", headers=headers, json={"nom": "À supprimer"}
)
assert template.status_code == 201
template_id = template.get_json()["id"]
assert client.post(
    f"/templates/{template_id}/exercices",
    headers=headers,
    json={"exercice_id": exercise_id},
).status_code == 201

assert client.delete(
    "/auth/account",
    headers=headers,
    json={"password": "WrongPassword"},
).status_code == 403
deleted = client.delete(
    "/auth/account",
    headers=headers,
    json={"password": "NewPassword456!"},
)
assert deleted.status_code == 200, deleted.data
assert_account_rows_removed(email)

# Public deletion requires confirmation; opening the link does not consume it.
public_email = "public-delete@example.test"
assert client.post(
    "/auth/register",
    json={
        "nom": "Public delete",
        "email": public_email,
        "password": "DeletePass123!",
    },
).status_code == 201
public_verify = token_for("Confirme ton adresse e-mail LIFTELY", public_email)
assert client.post(
    "/auth/verify-email", json={"token": public_verify}
).status_code == 200

unknown_delete = client.post(
    "/auth/account-deletion-request",
    json={"email": "nobody@example.test"},
)
known_delete = client.post(
    "/auth/account-deletion-request",
    json={"email": public_email},
)
assert unknown_delete.status_code == known_delete.status_code == 202
assert unknown_delete.get_json() == known_delete.get_json()

delete_token = token_for(
    "Demande de suppression du compte LIFTELY",
    public_email,
)
assert client.get(
    "/email/delete-account"
).status_code == 200
assert client.post(
    "/auth/account-delete-confirm", json={"token": delete_token}
).status_code == 200
assert client.post(
    "/auth/account-delete-confirm", json={"token": delete_token}
).status_code == 400
assert_account_rows_removed(public_email)
assert client.get("/email/reset-password").status_code == 200
print("LIFTELY account lifecycle smoke test: OK")
