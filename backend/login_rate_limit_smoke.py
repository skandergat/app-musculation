from __future__ import annotations

import os
import tempfile

TEMP_DIR = tempfile.TemporaryDirectory()
os.environ["LIFTELY_DB_PATH"] = os.path.join(TEMP_DIR.name, "login-limit.db")

from backend import app as backend  # noqa: E402

backend.app.config["TESTING"] = True
backend.assurer_base()
client = backend.app.test_client()

for attempt in range(10):
    response = client.post(
        "/auth/login",
        json={"email": "limit-test@example.test", "password": "WrongPassword123!"},
    )
    assert response.status_code == 401, (attempt, response.status_code, response.data)

blocked = client.post(
    "/auth/login",
    json={"email": "limit-test@example.test", "password": "WrongPassword123!"},
)
assert blocked.status_code == 429, (blocked.status_code, blocked.data)
assert blocked.get_json()["code"] == "login_rate_limited"

# The limit is scoped to the email/IP pair: another account identifier is
# still allowed to reach normal credential validation from the same client.
other_email = client.post(
    "/auth/login",
    json={"email": "other-test@example.test", "password": "WrongPassword123!"},
)
assert other_email.status_code == 401, (other_email.status_code, other_email.data)

print("LIFTELY login rate-limit smoke test: OK")
