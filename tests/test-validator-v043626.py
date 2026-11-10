import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).resolve().parents[1] / 'tools' / 'validate-v043626.py'
spec = importlib.util.spec_from_file_location('validator26', PATH)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

class Validator26Tests(unittest.TestCase):
    def test_fingerprint_metadata(self):
        with tempfile.TemporaryDirectory(dir=mod.ROOT) as tmp:
            rel = str(pathlib.Path(tmp).relative_to(mod.ROOT))
            with patch.dict(mod.TESTS, {'fake':['nonexistent-forja65-binary']}, clear=True):
                self.assertEqual(mod.run(['--output', rel]), 1)
            import json
            summary = json.loads((pathlib.Path(tmp)/'summary.json').read_text())
            self.assertGreater(summary['fingerprinted_sources'], 0)
            self.assertEqual(summary['version'], '0.4.36.26')
    def test_registered(self): self.assertEqual(len(mod.TESTS), 4)
    def test_list(self): self.assertEqual(mod.run(['--list']), 0)
    def test_bad_timeout(self):
        with self.assertRaises(SystemExit): mod.run(['--timeout','0'])
    def test_path_escape(self):
        with self.assertRaises(SystemExit): mod.run(['--output','../escape'])
    def test_missing_executable(self):
        with tempfile.TemporaryDirectory(dir=mod.ROOT) as tmp:
            rel = str(pathlib.Path(tmp).relative_to(mod.ROOT))
            with patch.dict(mod.TESTS, {'fake':['nonexistent-forja65-binary']}, clear=True):
                self.assertEqual(mod.run(['--output',rel]),1)
            self.assertEqual((pathlib.Path(tmp)/'summary.json').exists(),True)

if __name__=='__main__': unittest.main()
