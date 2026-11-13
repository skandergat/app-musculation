import hashlib
import unittest

from backend import app


class PasswordHashCompatibilityTests(unittest.TestCase):
    def test_legacy_salt_digest_format_remains_supported(self):
        password = "Legacy Password 123!"
        salt = bytes.fromhex("102132435465768798a9bacbdcedfe0f")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
        legacy = salt.hex() + "$" + digest.hex()

        self.assertTrue(app.verify_password(password, legacy))
        self.assertFalse(app.verify_password("wrong password", legacy))

    def test_versioned_600k_format_is_supported_before_it_is_written(self):
        password = "Versioned Password 123!"
        salt = bytes.fromhex("00112233445566778899aabbccddeeff")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
        versioned = "pbkdf2_sha256$600000$" + salt.hex() + "$" + digest.hex()

        self.assertTrue(app.verify_password(password, versioned))
        self.assertFalse(app.verify_password("wrong password", versioned))

    def test_malformed_or_unbounded_hash_is_rejected(self):
        malformed = [
            "",
            "not-a-hash",
            "pbkdf2_sha1$600000$0011$0011",
            "pbkdf2_sha256$999999999$00112233445566778899aabbccddeeff$" + ("00" * 32),
            "pbkdf2_sha256$600000$0011$0011",
        ]
        for value in malformed:
            with self.subTest(value=value):
                self.assertFalse(app.verify_password("anything", value))


if __name__ == "__main__":
    unittest.main()
