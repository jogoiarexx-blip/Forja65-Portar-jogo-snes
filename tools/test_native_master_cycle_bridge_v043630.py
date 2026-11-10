import importlib.util
import tempfile
import unittest
from pathlib import Path

P = Path(__file__).with_name('native-master-cycle-bridge-v043630.py')
spec = importlib.util.spec_from_file_location('cycle_bridge', P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class BridgeTests(unittest.TestCase):
    def run_conversion(self, data):
        with tempfile.TemporaryDirectory() as tmp:
            src, dst = Path(tmp)/'input.csv', Path(tmp)/'out.csv'
            src.write_text(data, encoding='utf-8')
            result = m.convert(src, dst)
            return result, dst.read_text()
    def test_valid_cycles(self):
        r, output = self.run_conversion('seq,master_cycle,kind,source,address,value,dummy\n0,6,read,CPU,0x10,255,false\n1,14,write,CPU,0x10,2,true\n')
        self.assertEqual(r['events'], 2)
        self.assertIn('14,16,write,2,True', output)
    def test_reject_missing_timestamps(self):
        with self.assertRaisesRegex(ValueError, 'master_cycle'):
            self.run_conversion('seq,kind,source,address,value\n0,read,CPU,16,1\n')
    def test_reject_nonmonotonic_cycles(self):
        with self.assertRaisesRegex(ValueError, 'Invalid timed'):
            self.run_conversion('seq,master_cycle,kind,source,address,value\n0,14,read,CPU,16,1\n1,6,write,CPU,16,2\n')
    def test_reject_nonmonotonic_sequence(self):
        with self.assertRaisesRegex(ValueError, 'Nonmonotonic'):
            self.run_conversion('seq,master_cycle,kind,source,address,value\n1,6,read,CPU,16,1\n1,14,write,CPU,16,2\n')
    def test_filter_non_cpu(self):
        r, _ = self.run_conversion('seq,master_cycle,kind,source,address,value\n0,6,read,PPU,16,1\n1,14,write,CPU,16,2\n')
        self.assertEqual(r['events'], 1)

if __name__ == '__main__': unittest.main()
