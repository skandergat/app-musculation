import unittest
from datetime import datetime
from unittest.mock import patch

from backend import app


class FakeCursor:
    def fetchone(self):
        return None


class FakeConnection:
    def __init__(self):
        self.statements = []
        self.committed = False
        self.closed = False

    def execute(self, statement, params=()):
        self.statements.append((statement, params))
        return FakeCursor()

    def commit(self):
        self.committed = True

    def close(self):
        self.closed = True


class SessionCleanupPerformanceTests(unittest.TestCase):
    def test_expired_sessions_are_not_deleted_on_every_authenticated_request(self):
        connection = FakeConnection()

        with app.app.test_request_context(
            "/auth/me",
            headers={"Authorization": "Bearer test-session-token"},
        ):
            with patch.object(app, "get_db", return_value=connection):
                self.assertIsNone(app.get_user_from_request())

        statements = [statement for statement, _ in connection.statements]
        self.assertTrue(
            any("FROM sessions" in statement for statement in statements),
            statements,
        )
        self.assertFalse(
            any("DELETE FROM sessions" in statement for statement in statements),
            statements,
        )
        self.assertTrue(connection.closed)

    def test_periodic_maintenance_deletes_expired_sessions(self):
        connection = FakeConnection()
        previous_cleanup = app._LAST_AUTH_CLEANUP
        try:
            app._LAST_AUTH_CLEANUP = datetime.min
            with app.app.test_request_context("/auth/me"):
                with patch.object(app, "get_db", return_value=connection):
                    app.purger_auth_temporaire_periodiquement()

            statements = [statement for statement, _ in connection.statements]
            self.assertTrue(
                any("DELETE FROM sessions WHERE date_expiration <= ?" in statement
                    for statement in statements),
                statements,
            )
            self.assertTrue(connection.committed)
            self.assertTrue(connection.closed)
        finally:
            app._LAST_AUTH_CLEANUP = previous_cleanup


if __name__ == "__main__":
    unittest.main()
