import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).resolve().parents[1] / 'tools' / 'validate-v043624.py'
spec = importlib.util.spec_from_file_location('forja_validator_24', PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ValidatorTests(unittest.TestCase):
    def test_suites_registered(self):
        self.assertEqual(set(mod.TESTS), {'rmw_bus_order', 'hardware_fast', 'python_suite', 'javascript_suite'})
    def test_list(self):
        self.assertEqual(mod.run(['--list']), 0)
    def test_invalid_timeout(self):
        with self.assertRaises(SystemExit) as error:
            mod.run(['--timeout', '0'])
        self.assertEqual(error.exception.code, 2)
    def test_path_escape_rejected(self):
        with self.assertRaises(SystemExit) as error:
            mod.run(['--output', '../outside'])
        self.assertEqual(error.exception.code, 2)
    def test_unavailable_binary_is_reported(self):
        with tempfile.TemporaryDirectory(dir=mod.ROOT) as tmp:
            relative = str(pathlib.Path(tmp).relative_to(mod.ROOT))
            with patch.dict(mod.TESTS, {'fake': ['missing-forja-test-binary-043624']}, clear=True):
                with patch('shutil.which', return_value=None):
                    self.assertEqual(mod.run(['--output', relative]), 1)
            import json
            report = json.loads((pathlib.Path(tmp) / 'summary.json').read_text())
            self.assertEqual(report['suites'][0]['status'], 'unavailable')
            self.assertFalse(report['all_passed'])

if __name__ == '__main__':
    unittest.main()
