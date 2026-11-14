import re
import unittest
from pathlib import Path


TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"


class ContentSecurityPolicyTemplateTests(unittest.TestCase):
    def test_templates_do_not_require_inline_script_or_style_exceptions(self):
        templates = sorted(TEMPLATES_DIR.glob("*.html"))
        self.assertTrue(templates, "No backend HTML templates were found")

        forbidden_patterns = {
            "inline script": re.compile(
                r"<script\b(?![^>]*\bsrc\s*=)[^>]*>", re.IGNORECASE
            ),
            "style element": re.compile(r"<style\b", re.IGNORECASE),
            "style attribute": re.compile(r"\sstyle\s*=", re.IGNORECASE),
            "inline event handler": re.compile(r"\son[a-z]+\s*=", re.IGNORECASE),
        }

        for template in templates:
            source = template.read_text(encoding="utf-8")
            for label, pattern in forbidden_patterns.items():
                with self.subTest(template=template.name, feature=label):
                    self.assertIsNone(
                        pattern.search(source),
                        f"{template.name} contains {label}; keep CSP strict.",
                    )


if __name__ == "__main__":
    unittest.main()
