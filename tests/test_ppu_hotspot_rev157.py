import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'tools'))
from ppu_hotspot_rev157 import analyze
class PpuHotspotTests(unittest.TestCase):
    def test_ranking(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'x.csv';p.write_text('register,reads,writes,total\n0x2104,0,300,300\n0x2118,1,2,3\n')
            result=analyze(p)
            self.assertEqual(result['total_accesses'],303)
            self.assertEqual(result['hotspots'][0]['register'],'0x2104')
    def test_bad_total(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'x.csv';p.write_text('register,reads,writes,total\n0x2104,1,1,900\n')
            with self.assertRaises(ValueError):analyze(p)
if __name__=='__main__':unittest.main()
