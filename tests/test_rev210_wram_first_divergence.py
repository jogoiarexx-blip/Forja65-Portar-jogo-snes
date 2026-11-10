import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / 'tools/rev210/wram-first-divergence.py'
spec = importlib.util.spec_from_file_location('wram_first_divergence', MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FirstDivergenceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.a = bytearray(module.WRAM_SIZE)
        self.b = bytearray(module.WRAM_SIZE)

    def dump(self, name, data):
        p = self.root / name
        p.write_bytes(data)
        return p

    def csv(self, name, headers, rows):
        p = self.root / name
        with p.open('w', newline='') as stream:
            w = csv.writer(stream)
            w.writerow(headers)
            w.writerows(rows)
        return p

    def test_equal(self):
        a = self.dump('a.bin', self.a)
        result = module.analyze({10: a}, {10: a})
        self.assertIsNone(result['first_divergence'])
        self.assertEqual(result['bytes_compared'], module.WRAM_SIZE)

    def test_first_divergence_with_trace_and_2180(self):
        self.b[0x100] = 0x44
        a0 = self.dump('a0.bin', self.a)
        b0 = self.dump('b0.bin', self.a)
        a1 = self.dump('a1.bin', self.b)
        b1 = self.dump('b1.bin', self.a)
        wr = self.csv('writes.csv', module.WRITES, [[11, '7E0100', 0, 68, '008123', '2180', 0, 0]])
        rd = self.csv('reads.csv', module.READS, [[11, '7E0100', 68, '00812A', 'bus', 0, 0]])
        result = module.analyze({10: a0, 11: a1}, {10: b0, 11: b1},
                                forja_writers=wr, forja_reads=rd)
        diff = result['first_divergence']
        self.assertEqual(diff['frame'], 11)
        self.assertEqual(diff['different_bytes'], 1)
        self.assertEqual(diff['addresses'][0]['writers']['forja'][0]['pc'], '008123')
        self.assertEqual(diff['addresses'][0]['readers']['forja'][0]['pc'], '00812A')
        self.assertEqual(result['frames_compared'], 2)

    def test_mismatched_frames_fail_closed(self):
        a = self.dump('a.bin', self.a)
        with self.assertRaisesRegex(ValueError, 'frame sets differ'):
            module.analyze({2: a}, {3: a})

    def test_invalid_snapshot_rejected(self):
        short = self.dump('short.bin', b'hi')
        with self.assertRaisesRegex(ValueError, 'expected exactly'):
            module.analyze({2: short}, {2: short})

    def test_traces_bad_header_rejected(self):
        a = self.dump('a.bin', self.a)
        fake = self.csv('fake.csv', ['frame', 'address'], [[0, '7E0000']])
        with self.assertRaisesRegex(ValueError, 'header mismatch'):
            module.analyze({0: a}, {0: a}, forja_writers=fake)


if __name__ == '__main__':
    unittest.main()
