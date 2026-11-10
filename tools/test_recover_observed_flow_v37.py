import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SRC=Path(__file__).with_name('recover-observed-flow.py')
spec=importlib.util.spec_from_file_location('recovered_flow', SRC)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class RecoverObservedFlowTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.dir=Path(self.tmp.name)
        self.write('forja65-unresolved-targets.txt','c0771f -> c07739\n')
        self.write('forja65-crash-trace.txt','FORJA65 RUNTIME TRACE\nc07704 A=1 E=0 M=0 X8=0 C=1\nc0771f A=f E=0 M=0 X8=0 C=0\n')
        self.write('forja65-runtime-hints.txt','rom=2f095d162726b5ea target=808123 from=808000 kind=FLOW e=0 m=0 x=1 c=1\n')
    def write(self, name, body): (self.dir/name).write_text(body)
    def run_recover(self): return mod.recover(self.dir,self.dir/'new.txt',self.dir/'proof.json')
    def test_success_recovers_measured_flags(self):
        line=self.run_recover()
        self.assertIn('target=c07739 from=c0771f kind=FLOW e=0 m=0 x=0 c=0', line)
        self.assertEqual(json.loads((self.dir/'proof.json').read_text())['source'],'CPU trace recovery, not a native runtime hint')
    def test_rejects_wrong_last_pc(self):
        self.write('forja65-crash-trace.txt','c0771f A=f E=0 M=0 X8=0 C=0\nc0abcd A=1 E=0 M=0 X8=0 C=1\n')
        with self.assertRaisesRegex(ValueError,'caller PC'): self.run_recover()
    def test_rejects_ambiguous_rom(self):
        with (self.dir/'forja65-runtime-hints.txt').open('a') as file:
            file.write('rom=0000000000000000 target=c0ffff from=c00000 kind=FLOW\n')
        with self.assertRaisesRegex(ValueError,'unique ROM'): self.run_recover()
    def test_rejects_ambiguous_unresolved(self):
        self.write('forja65-unresolved-targets.txt','c0771f -> c07739\nc01234 -> c05678\n')
        with self.assertRaisesRegex(ValueError,'exactly one'): self.run_recover()

if __name__ == '__main__': unittest.main()
