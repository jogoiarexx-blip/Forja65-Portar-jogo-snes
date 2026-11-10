"""REV150 synthetic tests for true earliest difference including convergence."""
import unittest
from first_divergence_rev149 import scan_first_disagreement

class ScanTests(unittest.TestCase):
    def test_unchanged(self):
        self.assertIsNone(scan_first_disagreement(15,lambda i: (i,i)))
    def test_transient_converges_before_final(self):
        self.assertEqual(3,scan_first_disagreement(8,lambda i: (0,1) if i==3 else (0,0)))
    def test_first_true_difference(self):
        self.assertEqual(1,scan_first_disagreement(10,lambda i: ('A','B') if i in (1,4) else ('A','A')))
    def test_bounds(self):
        with self.assertRaisesRegex(ValueError,'limit'):
            scan_first_disagreement(1001,lambda i:(0,0))
        for n in [-1,1.5]:
            with self.assertRaises(ValueError): scan_first_disagreement(n,lambda i:(0,0))

if __name__=='__main__':unittest.main()
