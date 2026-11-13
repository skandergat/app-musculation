import os
import unittest
from unittest.mock import Mock, patch

from backend import app as backend_app


class HealthEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.connection = Mock()
        self.connection.execute.return_value.fetchone.return_value = (1,)

    @patch.object(backend_app, "get_db")
    def test_health_reports_backend_without_secrets(self, get_db):
        get_db.return_value = self.connection
        with patch.dict(
            os.environ,
            {
                "LIFTELY_BREVO_API_KEY": "",
                "LIFTELY_EMAIL_FROM": "",
                "LIFTELY_SMTP_HOST": "",
                "LIFTELY_SMTP_USERNAME": "",
                "LIFTELY_SMTP_PASSWORD": "",
            },
        ):
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(
            payload["database_backend"],
            "postgresql" if backend_app.POSTGRES_ENABLED else "sqlite",
        )
        self.assertFalse(payload["transactional_email_configured"])
        self.assertNotIn("password", payload)
        self.assertNotIn("database_url", payload)

    @patch.object(backend_app, "get_db")
    def test_health_marks_brevo_configured_without_exposing_key(self, get_db):
        get_db.return_value = self.connection
        with patch.dict(
            os.environ,
            {
                "LIFTELY_BREVO_API_KEY": "non-empty-test-placeholder",
                "LIFTELY_EMAIL_FROM": "test@example.invalid",
            },
        ):
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["transactional_email_configured"])
        self.assertNotIn("non-empty-test-placeholder", response.get_data(as_text=True))

    @patch.object(backend_app, "get_db")
    def test_database_failure_returns_503(self, get_db):
        get_db.side_effect = RuntimeError("database unavailable")
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json(), {"status": "unhealthy"})


if __name__ == "__main__":
    unittest.main()
