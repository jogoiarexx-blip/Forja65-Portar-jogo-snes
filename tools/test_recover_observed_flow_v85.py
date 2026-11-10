#!/usr/bin/env python3
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SRC=Path(__file__).with_name('recover-observed-flow.py')
spec=importlib.util.spec_from_file_location('recovery_v85', SRC)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class RecoverySafety(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.folder=Path(self.tmp.name)
        self.write('forja65-unresolved-targets.txt', 'c0771f -> c07739\n')
        self.write('forja65-crash-trace.txt', 'FORJA65 RUNTIME TRACE\nc07704 A=1 E=0 M=0 X8=0 C=1\nc0771f A=f E=0 M=0 X8=0 C=0\n')
        self.write('forja65-runtime-hints.txt', 'rom=2f095d162726b5ea target=c07739 from=c0771f kind=FLOW e=0 m=0 x=0 c=0\n')
    def write(self,name,content): (self.folder/name).write_text(content)
    def run_recover(self): return mod.recover(self.folder,self.folder/'recovered.txt',self.folder/'proof.json')
    def test_happy_path_preserves_hashes(self):
        hint=self.run_recover()
        proof=json.loads((self.folder/'proof.json').read_text())
        self.assertIn('rom=2f095d162726b5ea',hint)
        self.assertEqual(len(proof['input_sha256']),3)
        self.assertTrue(all(len(x)==64 for x in proof['input_sha256'].values()))
    def test_rejects_extra_unresolved_line(self):
        self.write('forja65-unresolved-targets.txt','c0771f -> c07739\nother unverified target\n')
        with self.assertRaisesRegex(ValueError,'exactly one'): self.run_recover()
    def test_rejects_trace_with_newer_incomplete_state(self):
        self.write('forja65-crash-trace.txt','c0771f A=f E=0 M=0 X8=0 C=0\nc0771f A=f\n')
        with self.assertRaisesRegex(ValueError,'processor flags'): self.run_recover()
    def test_rejects_trace_with_newer_other_pc(self):
        self.write('forja65-crash-trace.txt','c0771f A=f E=0 M=0 X8=0 C=0\nc07720 A=f\n')
        with self.assertRaisesRegex(ValueError,'caller PC'): self.run_recover()
    def test_rejects_invalid_emulation_width(self):
        self.write('forja65-crash-trace.txt','c0771f A=f E=1 M=0 X8=1 C=0\n')
        with self.assertRaisesRegex(ValueError,'emulation CPU'): self.run_recover()
    def test_rom_case_insensitive_unique(self):
        self.write('forja65-runtime-hints.txt','rom=2f095d162726b5ea kind=FLOW\nrom=2F095D162726B5EA kind=FLOW\n')
        self.run_recover()
    def test_refuses_clobber_evidence(self):
        with self.assertRaisesRegex(ValueError,'overwrite source evidence'):
            mod.recover(self.folder,self.folder/'forja65-crash-trace.txt',self.folder/'proof.json')
    def test_refuses_single_output_path(self):
        with self.assertRaisesRegex(ValueError,'overwrite source evidence'):
            mod.recover(self.folder,self.folder/'one.txt',self.folder/'one.txt')
    def test_does_not_write_outputs_after_failure(self):
        self.write('forja65-crash-trace.txt','c0771f A=f\n')
        with self.assertRaises(ValueError): self.run_recover()
        self.assertFalse((self.folder/'recovered.txt').exists())
        self.assertFalse((self.folder/'proof.json').exists())

if __name__=='__main__':unittest.main()
