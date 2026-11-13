import json
import os
import unittest
from unittest.mock import MagicMock, Mock, patch

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

    @patch("urllib.request.urlopen")
    def test_brevo_probe_uses_sandbox_header_and_never_delivers(self, urlopen):
        response = MagicMock()
        response.status = 201
        urlopen.return_value = response
        backend_app._BREVO_SANDBOX_CACHE.update({"checked_at": None, "ok": False})

        with patch.dict(
            os.environ,
            {
                "LIFTELY_BREVO_API_KEY": "non-empty-test-placeholder",
                "LIFTELY_EMAIL_FROM": "sender@example.invalid",
            },
        ):
            result = self.client.post("/health/brevo-sandbox")

        self.assertEqual(result.status_code, 200)
        payload = result.get_json()
        self.assertTrue(payload["sandbox_request_accepted"])
        request = urlopen.call_args.args[0]
        body = json.loads(request.data.decode("utf-8"))
        self.assertEqual(body["headers"]["X-Sib-Sandbox"], "drop")
        self.assertEqual(body["to"][0]["email"], "no-delivery@invalid.example")
        self.assertNotIn("messageId", payload)

    @patch("urllib.request.urlopen")
    def test_brevo_probe_is_cached_for_five_minutes(self, urlopen):
        response = MagicMock()
        response.status = 201
        urlopen.return_value = response
        backend_app._BREVO_SANDBOX_CACHE.update({"checked_at": None, "ok": False})

        with patch.dict(
            os.environ,
            {
                "LIFTELY_BREVO_API_KEY": "non-empty-test-placeholder",
                "LIFTELY_EMAIL_FROM": "sender@example.invalid",
            },
        ):
            first = self.client.post("/health/brevo-sandbox")
            second = self.client.post("/health/brevo-sandbox")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.get_json()["cached"])
        urlopen.assert_called_once()

    def test_brevo_probe_fails_closed_when_not_configured(self):
        backend_app._BREVO_SANDBOX_CACHE.update({"checked_at": None, "ok": False})
        with patch.dict(
            os.environ,
            {"LIFTELY_BREVO_API_KEY": "", "LIFTELY_EMAIL_FROM": ""},
        ):
            response = self.client.post("/health/brevo-sandbox")
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.get_json()["sandbox_request_accepted"])


if __name__ == "__main__":
    unittest.main()
