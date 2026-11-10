import importlib.util
import tempfile
import unittest
from pathlib import Path

P = Path(__file__).with_name('compare-runtime-bus-clock-v043631.py')
spec = importlib.util.spec_from_file_location('cmp_clock', P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
HEADER = ('# FORJA_BUS_CLOCK_TRACE 1 timing_basis=runtime_scheduler_clock bus_microcycle_accurate=false\n'
          'seq,master_cycle,frame,pc,kind,source,address,value,dummy\n')

class ClockComparisonTests(unittest.TestCase):
    def test_match_and_first_divergence_with_pc(self):
        with tempfile.TemporaryDirectory() as directory:
            a,b = [Path(directory)/x for x in ('a.csv','b.csv')]
            body='0,8,0,8388608,read,CPU,8257536,17,unknown\n1,8,0,8388609,write,CPU,8257536,34,unknown\n'
            a.write_text(HEADER+body)
            b.write_text(HEADER+body.replace('8257536,34','8257536,35'))
            ref, candidate = m.load(a),m.load(b)
            result = m.compare(ref,candidate)
            self.assertFalse(result['match'])
            self.assertEqual(result['first_divergence'],1)
            self.assertEqual(result['candidate']['pc'],8388609)
            b.write_text(HEADER+body)
            self.assertTrue(m.compare(ref,m.load(b))['match'])

    def test_clock_mismatch_and_ignore_clock(self):
        with tempfile.TemporaryDirectory() as directory:
            a,b=[Path(directory)/x for x in ('a.csv','b.csv')]
            a.write_text(HEADER+'0,8,0,8388608,read,CPU,0,1,unknown\n')
            b.write_text(HEADER+'0,9,0,8388608,read,CPU,0,1,unknown\n')
            self.assertFalse(m.compare(m.load(a),m.load(b))['match'])
            self.assertTrue(m.compare(m.load(a),m.load(b),False)['match'])

    def test_invalid_clock_and_sequence_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            f=Path(directory)/'bad.csv'
            f.write_text(HEADER+'0,12,0,8388608,read,CPU,0,1,unknown\n1,11,0,8388609,read,CPU,0,2,unknown\n')
            with self.assertRaisesRegex(ValueError,'Invalid bus record'):m.load(f)

    def test_origin_filter(self):
        with tempfile.TemporaryDirectory() as directory:
            f=Path(directory)/'filtered.csv'
            f.write_text(HEADER+'0,4,0,0,write,HDMA,8448,1,unknown\n1,4,0,0,read,CPU,1,3,unknown\n')
            self.assertEqual(len(m.load(f)),1)
            self.assertEqual(len(m.load(f,('HDMA',))),1)

if __name__ == '__main__':unittest.main()
