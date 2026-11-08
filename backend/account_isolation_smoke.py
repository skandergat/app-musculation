"""Regression tests ensuring one account cannot access another account's data."""
from __future__ import annotations

import os
import sqlite3
import tempfile
from urllib.parse import parse_qs, urlsplit

TEMP = tempfile.TemporaryDirectory()
os.environ["LIFTELY_DB_PATH"] = os.path.join(TEMP.name, "account-isolation.db")

from backend import app as backend  # noqa: E402

backend.app.config["TESTING"] = True
backend.assurer_base()
client = backend.app.test_client()


def action_token(email: str, subject: str) -> str:
    matches = [
        item for item in backend.app.config["TEST_EMAIL_OUTBOX"]
        if item["to"] == email and item["subject"] == subject
    ]
    assert matches, (email, subject)
    url = matches[-1]["body"].splitlines()[-1]
    token = parse_qs(urlsplit(url).fragment).get("token", [""])[0]
    assert token
    return token


def create_account(email: str) -> dict:
    registered = client.post(
        "/auth/register",
        json={"nom": email.split("@")[0], "email": email,
              "password": "IsolationTest123!"},
    )
    assert registered.status_code == 201, registered.data
    verified = client.post(
        "/auth/verify-email",
        json={"token": action_token(email, "Confirme ton adresse e-mail LIFTELY")},
    )
    assert verified.status_code == 200, verified.data
    logged_in = client.post(
        "/auth/login",
        json={"email": email, "password": "IsolationTest123!"},
    )
    assert logged_in.status_code == 200, logged_in.data
    return {"Authorization": "Bearer " + logged_in.get_json()["token"]}


headers_a = create_account("isolation-a@example.test")
headers_b = create_account("isolation-b@example.test")

with sqlite3.connect(backend.DB_PATH) as conn:
    exercise_id = conn.execute(
        "SELECT id FROM exercices WHERE actif = 1 ORDER BY id LIMIT 1"
    ).fetchone()[0]

# Account A creates a private template.
template = client.post(
    "/templates", headers=headers_a, json={"nom": "Private template A"}
)
assert template.status_code == 201, template.data
template_id = template.get_json()["id"]
added_to_template = client.post(
    f"/templates/{template_id}/exercices",
    headers=headers_a,
    json={"exercice_id": exercise_id},
)
assert added_to_template.status_code == 201, added_to_template.data

# Account B cannot read, rename, or delete A's template.
assert client.get(
    f"/templates/{template_id}", headers=headers_b
).status_code == 404
assert client.put(
    f"/templates/{template_id}",
    headers=headers_b,
    json={"nom": "Hijacked"},
).status_code == 404
assert client.delete(
    f"/templates/{template_id}", headers=headers_b
).status_code == 404

# Account A creates a private workout and a set.
session = client.post("/seances", headers=headers_a)
assert session.status_code == 201, session.data
session_id = session.get_json()["seance_id"]
exercise = client.post(
    f"/seances/{session_id}/exercices",
    headers=headers_a,
    json={"exercice_id": exercise_id},
)
assert exercise.status_code == 201, exercise.data
created_set = client.post(
    f"/seances/{session_id}/series",
    headers=headers_a,
    json={"exercice_id": exercise_id, "poids": 42.5, "repetitions": 8},
)
assert created_set.status_code == 201, created_set.data
series_id = created_set.get_json()["series_id"]

# Cross-account read/write/delete/finish attempts must not disclose or mutate A's data.
assert client.post(
    f"/seances/{session_id}/exercices",
    headers=headers_b,
    json={"exercice_id": exercise_id},
).status_code == 404
assert client.put(
    f"/seances/{session_id}/series/{series_id}",
    headers=headers_b,
    json={"poids": 99, "repetitions": 1},
).status_code == 404
assert client.delete(
    f"/seances/{session_id}/series/{series_id}",
    headers=headers_b,
).status_code == 404
assert client.delete(
    f"/seances/{session_id}/exercices/{exercise_id}",
    headers=headers_b,
).status_code == 404
assert client.post(
    f"/seances/{session_id}/terminer", headers=headers_b
).status_code == 404
assert client.post(
    f"/seances/{session_id}/annuler", headers=headers_b
).status_code == 404

# Private history/progression and active-workout views remain account-scoped.
assert client.get("/historique", headers=headers_b).get_json() == []
assert client.get("/progression", headers=headers_b).get_json() == []
assert client.get("/seances/active", headers=headers_b).get_json() == {
    "seance": None
}

# The failed attempts did not alter A's records.
active_a = client.get("/seances/active", headers=headers_a)
assert active_a.status_code == 200, active_a.data
assert active_a.get_json()["seance"]["id"] == session_id
assert len(active_a.get_json()["seance"]["series"]) == 1
assert active_a.get_json()["seance"]["series"][0]["poids"] == 42.5
assert client.get(
    f"/templates/{template_id}", headers=headers_a
).status_code == 200

print("LIFTELY account isolation smoke test: OK")
