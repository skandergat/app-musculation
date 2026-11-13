"""Tests de sécurité ciblés : anti-brute-force et en-têtes HTTP globaux."""
from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
import tempfile
from datetime import datetime, timedelta

TEMP = tempfile.TemporaryDirectory()
DB = os.path.join(TEMP.name, "security-smoke.db")
os.environ["LIFTELY_DB_PATH"] = DB

from backend import app as backend  # noqa: E402

backend.app.config["TESTING"] = True
client = backend.app.test_client()
backend.assurer_base()


def add_user(email: str, password: str) -> None:
    conn = sqlite3.connect(DB)
    conn.execute(
        "INSERT INTO users (nom, email, password_hash, date_creation, email_verified_at) "
        "VALUES (?, ?, ?, ?, ?)",
        ("Security Test", email, backend.hash_password(password),
         datetime.now().isoformat(), datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()


def add_argon2_user(email: str, password: str) -> None:
    stored = backend.PASSWORD_HASHER.hash(password)
    conn = sqlite3.connect(DB)
    conn.execute(
        "INSERT INTO users (nom, email, password_hash, date_creation, email_verified_at) "
        "VALUES (?, ?, ?, ?, ?)",
        ("Argon2 Security Test", email, stored,
         datetime.now().isoformat(), datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()


def add_legacy_user(email: str, password: str) -> None:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    stored = salt.hex() + "$" + digest.hex()
    conn = sqlite3.connect(DB)
    conn.execute(
        "INSERT INTO users (nom, email, password_hash, date_creation, email_verified_at) "
        "VALUES (?, ?, ?, ?, ?)",
        ("Legacy Security Test", email, stored,
         datetime.now().isoformat(), datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()


# En-têtes présents sur JSON, page HTML et réponse d'erreur.
for response in (client.get("/exercices"), client.get("/privacy"),
                 client.get("/route-inexistante")):
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Permissions-Policy"] == "camera=(), microphone=(), geolocation=()"
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]

# Le proxy HTTPS de test doit déclencher HSTS.
https_response = client.get("/exercices", headers={"X-Forwarded-Proto": "https"})
assert "max-age=31536000" in https_response.headers["Strict-Transport-Security"]

# Dix échecs sont acceptés, le onzième est bloqué pour ce couple compte/IP.
email = "bruteforce@example.test"
add_user(email, "CorrectPassword123!")
for attempt in range(10):
    response = client.post(
        "/auth/login",
        json={"email": email, "password": "WrongPassword123!"},
        environ_overrides={"REMOTE_ADDR": "198.51.100.10"},
    )
    assert response.status_code == 401, (attempt, response.status_code, response.data)
blocked = client.post(
    "/auth/login",
    json={"email": email, "password": "WrongPassword123!"},
    environ_overrides={"REMOTE_ADDR": "198.51.100.10"},
)
assert blocked.status_code == 429, blocked.data
assert blocked.headers["Retry-After"] == "900"
assert blocked.get_json()["code"] == "login_rate_limited"

# Un succès efface le compteur du compte/IP ; l'IP garde son compteur global.
success_email = "success-reset@example.test"
add_user(success_email, "CorrectPassword123!")
ip = "198.51.100.11"
for _ in range(9):
    assert client.post(
        "/auth/login",
        json={"email": success_email, "password": "WrongPassword123!"},
        environ_overrides={"REMOTE_ADDR": ip},
    ).status_code == 401
success = client.post(
    "/auth/login",
    json={"email": success_email, "password": "CorrectPassword123!"},
    environ_overrides={"REMOTE_ADDR": ip},
)
assert success.status_code == 200, success.data
assert client.post(
    "/auth/login",
    json={"email": success_email, "password": "WrongPassword123!"},
    environ_overrides={"REMOTE_ADDR": ip},
).status_code == 401

# La release de compatibilité doit aussi pouvoir authentifier un hash Argon2id.
versioned_email = "versioned@example.test"
add_argon2_user(versioned_email, "VersionedPassword123!")
versioned_login = client.post(
    "/auth/login",
    json={"email": versioned_email, "password": "VersionedPassword123!"},
    environ_overrides={"REMOTE_ADDR": "198.51.100.13"},
)
assert versioned_login.status_code == 200, versioned_login.data

# Un compte PBKDF2 historique est re-haché en Argon2id au login réussi.
legacy_email = "legacy-rehash@example.test"
legacy_password = "LegacyRehash123!"
add_legacy_user(legacy_email, legacy_password)
legacy_login = client.post(
    "/auth/login",
    json={"email": legacy_email, "password": legacy_password},
    environ_overrides={"REMOTE_ADDR": "198.51.100.14"},
)
assert legacy_login.status_code == 200, legacy_login.data
conn = sqlite3.connect(DB)
rehash = conn.execute(
    "SELECT password_hash FROM users WHERE email = ?", (legacy_email,)
).fetchone()[0]
conn.close()
assert rehash.startswith("$argon2id$"), rehash[:40]
assert backend.verify_password(legacy_password, rehash)

# Le rate limit e-mail doit utiliser l'IP normalisée par ProxyFix,
# jamais le premier élément X-Forwarded-For contrôlable par le client.
spoofed_ip = "203.0.113.250"
trusted_client_ip = "198.51.100.250"
with backend.app.test_request_context(
    "/auth/register",
    headers={"X-Forwarded-For": f"{spoofed_ip}, {trusted_client_ip}"},
    environ_overrides={"REMOTE_ADDR": "10.0.0.10"},
):
    conn = backend.get_db()
    assert backend.autoriser_envoi_email(conn, "proxy-check@example.test") is True
    conn.commit()
    conn.close()

conn = sqlite3.connect(DB)
email_ip_key = backend.hash_token("ip:" + trusted_client_ip)
spoofed_ip_key = backend.hash_token("ip:" + spoofed_ip)
assert conn.execute(
    "SELECT COUNT(*) FROM auth_mail_limits WHERE key_hash = ?", (email_ip_key,)
).fetchone()[0] == 1
assert conn.execute(
    "SELECT COUNT(*) FROM auth_mail_limits WHERE key_hash = ?", (spoofed_ip_key,)
).fetchone()[0] == 0
conn.close()

# La limite IP globale s'applique même avec des adresses e-mail différentes.
for attempt in range(60):
    response = client.post(
        "/auth/login",
        json={"email": f"unknown-{attempt}@example.test", "password": "WrongPassword123!"},
        environ_overrides={"REMOTE_ADDR": "198.51.100.12"},
    )
    assert response.status_code == 401, (attempt, response.status_code)
global_block = client.post(
    "/auth/login",
    json={"email": "another@example.test", "password": "WrongPassword123!"},
    environ_overrides={"REMOTE_ADDR": "198.51.100.12"},
)
assert global_block.status_code == 429, global_block.data

# Une fenêtre ancienne doit être remise à zéro.
conn = sqlite3.connect(DB)
conn.execute(
    "UPDATE auth_login_limits SET window_start = ? WHERE key_hash = ?",
    ((datetime.now() - timedelta(minutes=16)).isoformat(),
     backend.hash_token("login:email_ip:bruteforce@example.test:198.51.100.10")),
)
conn.commit()
conn.close()
expired = client.post(
    "/auth/login",
    json={"email": email, "password": "WrongPassword123!"},
    environ_overrides={"REMOTE_ADDR": "198.51.100.10"},
)
assert expired.status_code == 401, expired.data

print("LIFTELY security smoke test: OK")
