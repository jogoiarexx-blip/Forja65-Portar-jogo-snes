#!/usr/bin/env python3
"""Unit tests for ROM-backed observed flow provenance checks (v0.32)."""
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

HERE = Path(__file__).resolve()
TOOL = HERE.with_name('integrate-observed-flow.py')
spec = importlib.util.spec_from_file_location('observed_integrator_v32', TOOL)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ProofValidation(unittest.TestCase):
    def setUp(self):
        self.proof = {'schema': 1, 'rom': '2f095d162726b5ea',
                      'routine': 'C0FC98', 'variants': 2,
                      'decoded': [{'entryPc': 0xC0FC98, 'pcs': [0xC0FC98, 0xC0FC9A]},
                                  {'entryPc': 0xC0FC98, 'pcs': [0xC0FC98, 0xC0FC9A]}],
                      'observed': [{'target': 0xC0FC98, 'from': 0xC0F94B}]}
        self.td = TemporaryDirectory()
        self.addCleanup(self.td.cleanup)
        self.path = Path(self.td.name) / 'proof.json'

    def check(self, expected_rom='2f095d162726b5ea'):
        self.path.write_text(json.dumps(self.proof))
        mod.validate_proof(self.path, 'C0FC98', [('fn1', 'body'), ('fn2', 'body')],
                           {0xC0FC98, 0xC0FC9A}, expected_rom)

    def test_valid_rom_proof(self):
        self.check()

    def test_wrong_rom_refused(self):
        with self.assertRaisesRegex(ValueError, 'fingerprint'):
            self.check('ffffffffffffffff')

    def test_missing_pc_refused(self):
        self.proof['decoded'][0]['pcs'] = [0xC0FC98]
        self.proof['decoded'][1]['pcs'] = [0xC0FC98]
        with self.assertRaisesRegex(ValueError, 'PCs'):
            self.check()

    def test_missing_observation_refused(self):
        self.proof['observed'] = []
        with self.assertRaisesRegex(ValueError, 'observation'):
            self.check()

    def test_other_routine_refused(self):
        self.proof['routine'] = 'C0F923'
        with self.assertRaisesRegex(ValueError, 'routine'):
            self.check()


if __name__ == '__main__':
    unittest.main()
