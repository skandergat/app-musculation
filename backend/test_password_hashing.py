import hashlib
import unittest

from backend import app


class PasswordHashingTests(unittest.TestCase):
    def test_new_hash_uses_versioned_600k_pbkdf2(self):
        password = "Correct Horse Battery Staple!"
        salt = bytes.fromhex("00112233445566778899aabbccddeeff")
        stored = app.hash_password(password, salt=salt)

        algorithm, iterations, stored_salt, digest = stored.split("$")
        self.assertEqual(algorithm, "pbkdf2_sha256")
        self.assertEqual(int(iterations), 600_000)
        self.assertEqual(stored_salt, salt.hex())
        self.assertEqual(len(bytes.fromhex(digest)), 32)
        self.assertTrue(app.verify_password(password, stored))
        self.assertFalse(app.verify_password("wrong password", stored))
        self.assertFalse(app.password_hash_needs_upgrade(stored))

    def test_legacy_hash_remains_valid_and_requires_upgrade(self):
        password = "Legacy Password 123!"
        salt = bytes.fromhex("102132435465768798a9bacbdcedfe0f")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
        legacy = salt.hex() + "$" + digest.hex()

        self.assertTrue(app.verify_password(password, legacy))
        self.assertFalse(app.verify_password("wrong password", legacy))
        self.assertTrue(app.password_hash_needs_upgrade(legacy))

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
