import unittest
from decimal import Decimal

try:
    from .migration_preflight import canonical_value, compare_row_multisets, row_signature
except ImportError:
    from migration_preflight import canonical_value, compare_row_multisets, row_signature


class MigrationPreflightComparisonTests(unittest.TestCase):
    def test_numeric_values_compare_across_sqlite_postgres_numeric_types(self):
        self.assertEqual(canonical_value(1), canonical_value(1.0))
        self.assertEqual(canonical_value(Decimal("1.000")), canonical_value(1))

    def test_identical_rows_match_independent_of_order(self):
        result = compare_row_multisets(
            [(1, "alice"), (2, "bob")],
            [(2, "bob"), (1, "alice")],
        )
        self.assertTrue(result["matches"])
        self.assertEqual(result["source_rows_missing_on_target"], 0)
        self.assertEqual(result["target_rows_not_in_source"], 0)

    def test_changed_row_content_is_detected_even_when_counts_match(self):
        result = compare_row_multisets(
            [(1, "alice"), (2, "bob")],
            [(1, "alice"), (2, "robert")],
        )
        self.assertFalse(result["matches"])
        self.assertEqual(result["source_rows_missing_on_target"], 1)
        self.assertEqual(result["target_rows_not_in_source"], 1)
        self.assertTrue(result["missing_row_fingerprints"])
        self.assertTrue(result["extra_row_fingerprints"])

    def test_duplicate_rows_are_compared_as_a_multiset(self):
        result = compare_row_multisets(
            [(1, "same"), (1, "same"), (2, "other")],
            [(1, "same"), (2, "other"), (2, "other")],
        )
        self.assertFalse(result["matches"])
        self.assertEqual(result["source_rows_missing_on_target"], 1)
        self.assertEqual(result["target_rows_not_in_source"], 1)

    def test_row_signature_does_not_expose_raw_row_values(self):
        signature = row_signature(("private@example.test", "secret-value"))
        self.assertEqual(len(signature), 64)
        self.assertNotIn("private@example.test", signature)
        self.assertNotIn("secret-value", signature)


if __name__ == "__main__":
    unittest.main()
