"""REV165 regression: a tail-byte change of stride-eight record is not invisible."""
import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_record_probe_v25 import records

class RecordTail(unittest.TestCase):
    def test_six_byte_record_preserved(self):
        image=bytes([1,0,2,0,3,0])*4
        self.assertEqual(records(image,0,4,6,4)[0],(1,2,3))
    def test_tail_change_detected_stride_eight(self):
        b=bytes([1,0,2,0,3,0,0,0])*4
        a=bytearray(b);a[6]=0x5a
        br=records(b,0,4,8,4);ar=records(a,0,4,8,4)
        self.assertNotEqual(ar[0],br[0])
        self.assertEqual(ar[0][2],br[0][2]) # tag may be unchanged
        self.assertEqual(ar[1:],br[1:])
    def test_tail_change_detected_stride_sixtyfour(self):
        b=bytes([1,0,2,0,3,0])+bytes(58)
        a=bytearray(b);a[63]=123
        self.assertNotEqual(records(a,0,1,64,4),records(b,0,1,64,4))

if __name__=='__main__':unittest.main()
