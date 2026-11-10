import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from compare_native_coverage_rev154 import compare
class CoverageTests(unittest.TestCase):
    def setUp(self):
        self.qa=dict(rom='abc',frames='10',instructions='100',framebuffer_hash='1234',wram_hash='5678',nmi_services='1',irq_services='0')
    def test_reduction(self):
        r=compare(self.qa,dict(blocks=4,instructions=20),self.qa,dict(blocks=2,instructions=5))
        self.assertTrue(r['pass']);self.assertEqual(r['interpreted_reduction_percent'],75)
        self.assertEqual(r['native_share_after'],95)
    def test_regression(self):
        r=compare(self.qa,dict(blocks=2,instructions=5),self.qa,dict(blocks=3,instructions=8))
        self.assertFalse(r['pass'])
    def test_state_divergence(self):
        new=dict(self.qa,wram_hash='0000')
        r=compare(self.qa,dict(blocks=4,instructions=20),new,dict(blocks=2,instructions=4))
        self.assertFalse(r['pass']);self.assertIn('wram_hash',r['mismatches'])
    def test_missing_fields(self):
        with self.assertRaises(ValueError): compare({},dict(instructions=20),self.qa,dict(instructions=3))
if __name__=='__main__':unittest.main()
