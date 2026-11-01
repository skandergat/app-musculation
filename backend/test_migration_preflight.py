import sqlite3
import unittest
from decimal import Decimal

try:
    from .migration_preflight import (\n        canonical_value, compare_row_multisets, row_signature,\n        sqlite_schema_signature, compare_schema_signatures,\n    )
except ImportError:
    from migration_preflight import (\n        canonical_value, compare_row_multisets, row_signature,\n        sqlite_schema_signature, compare_schema_signatures,\n    )


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


    def test_sqlite_schema_signature_captures_columns_primary_key_and_unique_indexes(self):
        conn = sqlite3.connect(":memory:")
        try:
            conn.executescript(
                """
                CREATE TABLE sample (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL DEFAULT 'x',
                    amount REAL,
                    enabled INTEGER DEFAULT 1
                );
                CREATE UNIQUE INDEX idx_sample_name ON sample(name);
                """
            )
            signature = sqlite_schema_signature(conn, "sample")
            self.assertEqual(signature["primary_key"], ["id"])
            self.assertIn((True, ("name",), None), signature["indexes"])
            name = next(c for c in signature["columns"] if c["name"] == "name")
            self.assertEqual(name["type"], "text")
            self.assertTrue(name["not_null"])
            self.assertEqual(name["default"], "'x'")
        finally:
            conn.close()

    def test_schema_comparison_detects_type_default_primary_key_and_index_drift(self):
        source = {
            "columns": [
                {"name": "id", "type": "integer", "not_null": True, "default": None},
                {"name": "name", "type": "text", "not_null": True, "default": "'x'"},
            ],
            "primary_key": ["id"],
            "indexes": [(True, ("name",), None)],
        }
        target = {
            "columns": [
                {"name": "id", "type": "integer", "not_null": True, "default": None},
                {"name": "name", "type": "text", "not_null": True, "default": "'y'"},
            ],
            "primary_key": ["name"],
            "indexes": [],
        }
        issues = compare_schema_signatures(source, target)
        self.assertTrue(any(issue.startswith("default_mismatch:name") for issue in issues))
        self.assertTrue(any(issue.startswith("primary_key_mismatch") for issue in issues))
        self.assertIn("index_or_unique_constraint_mismatch", issues)

    def test_row_signature_does_not_expose_raw_row_values(self):
        signature = row_signature(("private@example.test", "secret-value"))
        self.assertEqual(len(signature), 64)
        self.assertNotIn("private@example.test", signature)
        self.assertNotIn("secret-value", signature)


if __name__ == "__main__":
    unittest.main()
