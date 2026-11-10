#!/usr/bin/env python3
"""Auditor's reusable argument and ROM safety checks without Soldiers sources."""
import importlib.util
import unittest
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('v38_audit',HERE/'audit_integrated_flow.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
mod=module.load_integrator(HERE)

class AuditSafety(unittest.TestCase):
    def test_import_shared_forja_integrator(self):
        self.assertTrue(callable(mod.validate_proof))

    def test_reject_invalid_address_before_files(self):
        with self.assertRaisesRegex(ValueError,'invalid routine address'):
            module.audit(HERE, HERE, 'BADVALUE', '2f095d162726b5ea', mod)

    def test_missing_rom_proof_does_not_pass(self):
        with self.assertRaises(FileNotFoundError):
            module.audit(HERE, HERE, 'C0803E', '2f095d162726b5ea', mod)

if __name__=='__main__': unittest.main()
