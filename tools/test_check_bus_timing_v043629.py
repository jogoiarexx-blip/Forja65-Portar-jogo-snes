import importlib.util
import tempfile
import unittest
from pathlib import Path

path=Path(__file__).with_name('check-bus-timing-v043629.py')
spec=importlib.util.spec_from_file_location('bus_timing',path)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class BusTimingTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
    def write(self, text):
        p=Path(self.tmp.name)/'trace.csv'
        p.write_text(text)
        return p
    def test_equal(self):
        rows=m.load(self.write('master_cycle,address,operation,value,dummy\n12,4096,read,34,false\n18,4096,write,34,true\n'))
        self.assertTrue(m.compare(rows,rows)['match'])
    def test_cycle_mismatch(self):
        a=[{'master_cycle':12}]
        b=[{'master_cycle':13}]
        self.assertEqual(m.compare(a,b)['first_divergence'],0)
    def test_missing_real_clock_rejected(self):
        with self.assertRaises(ValueError):
            m.load(self.write('cycle,address,operation,value\n0,1,read,2\n'))
    def test_invalid_dummy_rejected(self):
        with self.assertRaises(ValueError):
            m.load(self.write('master_cycle,address,operation,value,dummy\n12,1,read,2,maybe\n'))
    def test_invalid_address_rejected(self):
        with self.assertRaises(ValueError):
            m.load(self.write('master_cycle,address,operation,value\n12,16777216,read,2\n'))
    def test_nonmonotonic_rejected(self):
        with self.assertRaises(ValueError):
            m.load(self.write('master_cycle,address,operation,value\n13,1,read,2\n12,1,read,2\n'))

if __name__=='__main__': unittest.main()
