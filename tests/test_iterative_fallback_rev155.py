import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from iterative_fallback_rev155 import approve,parse_qa,parse_interpreter,FIELDS
class TestQA(unittest.TestCase):
    def setUp(self):
        self.base={k:'same' for k in FIELDS}
        self.prior={'instructions':4560}
        self.next={'instructions':2320}
    def test_same_state_and_lower_interpretation(self):
        self.assertEqual(approve(self.base,self.prior,self.base,self.next)[0],True)
    def test_reject_changed_wram(self):
        q={**self.base,'wram_hash':'different'}
        self.assertFalse(approve(self.base,self.prior,q,self.next)[0])
    def test_reject_changed_cpu_count(self):
        q={**self.base,'instructions':'different'}
        self.assertFalse(approve(self.base,self.prior,q,self.next)[0])
    def test_reject_equal_interpretation(self):
        self.assertFalse(approve(self.base,self.prior,self.base,{'instructions':4560})[0])
    def test_reject_increased_interpretation(self):
        self.assertFalse(approve(self.base,self.prior,self.base,{'instructions':9999})[0])
    def test_zero_fallback_is_valid_if_reporter_semantics_confirmed(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(parse_interpreter(Path(d)/'nonexistent',True)['instructions'],0)
            with self.assertRaises(ValueError):parse_interpreter(Path(d)/'nonexistent',False)

    def test_parse_logs(self):
        with tempfile.TemporaryDirectory() as d:
            a=Path(d)/'qa';a.write_text(''.join(k+'='+str(v)+'\n' for k,v in self.base.items()))
            self.assertEqual(parse_qa(a),self.base)
            b=Path(d)/'interp';b.write_text('FORJA65_CPU_INTERPRETER 1\nblocks=80\ninstructions=4560\n# entrada\n858D97 M0X0 from=858D79 count=80\n')
            self.assertEqual(parse_interpreter(b)['entries'],['858D97 M0X0 from=858D79 count=80'])
if __name__=='__main__':unittest.main()
