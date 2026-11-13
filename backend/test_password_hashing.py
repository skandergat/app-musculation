import hashlib
import unittest

from backend import app


class PasswordHashCompatibilityTests(unittest.TestCase):
    def test_legacy_pbkdf2_hash_remains_supported(self):
        password = "Legacy Password 123!"
        salt = bytes.fromhex("102132435465768798a9bacbdcedfe0f")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
        legacy = salt.hex() + "$" + digest.hex()

        self.assertTrue(app.verify_password(password, legacy))
        self.assertFalse(app.verify_password("wrong password", legacy))

    def test_argon2id_format_is_supported_before_it_is_written(self):
        password = "Argon2id Password 123!"
        encoded = app.PASSWORD_HASHER.hash(password)

        self.assertTrue(encoded.startswith("$argon2id$"))
        self.assertTrue(app.verify_password(password, encoded))
        self.assertFalse(app.verify_password("wrong password", encoded))

    def test_malformed_hash_is_rejected(self):
        malformed = [
            "",
            "not-a-hash",
            "$argon2id$not-a-valid-encoding",
            "salt$not-hex",
            "00112233445566778899aabbccddeeff$" + ("00" * 31),
            "pbkdf2_sha256$600000$0011$0011",
        ]
        for value in malformed:
            with self.subTest(value=value):
                self.assertFalse(app.verify_password("anything", value))


if __name__ == "__main__":
    unittest.main()
