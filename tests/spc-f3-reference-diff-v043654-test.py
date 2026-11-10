#!/usr/bin/env python3
"""SPC700 $F3 trace differential: no invented hardware cycles."""
import csv
import importlib.util
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'tools' / 'spc_f3_trace_diff.py'
spec = importlib.util.spec_from_file_location('spc_f3_trace_diff', SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

BASE = {
    'pc': 0x300, 'opcode': 0x8f, 'dsp_addr': 0x6c, 'value': 0x20,
    'access_ordinal': 4, 'logical_accesses': 4, 'instruction_cycles': 5,
    'completion_master': 105, 'accepted': 1,
    'instruction_id': 19, 'spc_cycles_end': 35,
}

class DiffTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = pathlib.Path(self.tmp.name)

    def csv(self, name, events, comment='# dropped=0; access_ordinal_is_not_hardware_cycle=1'):
        p = self.folder / name
        with p.open('w', newline='') as f:
            cols = list(events[0]) if events else list(BASE)
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader(); w.writerows(events)
            f.write(comment + '\n')
        return p

    def test_identical_logical_trace_preserves_unknown_physical_time(self):
        events = [dict(BASE)]
        result = mod.compare(mod.read_trace(self.csv('a.csv', events)),
                             mod.read_trace(self.csv('b.csv', events)))
        self.assertTrue(result['logical_sequence_matches'])
        self.assertEqual('not_comparable', result['physical_timing']['status'])

    def test_first_divergence_and_exit_status(self):
        a = [dict(BASE), dict(BASE, instruction_id=20, spc_cycles_end=40,
                                    completion_master=110, value=0)]
        b = [dict(x) for x in a]; b[1]['value'] = 32
        out = self.folder / 'report.json'
        p = subprocess.run([sys.executable, str(SCRIPT), '--observed', str(self.csv('a.csv', a)),
                            '--reference', str(self.csv('b.csv', b)), '--report', str(out)],
                           capture_output=True, text=True)
        self.assertEqual(1, p.returncode, p.stderr)
        self.assertIn('"event_index": 1', out.read_text())

    def test_repeated_pc_with_missing_instruction_detected(self):
        a = [dict(BASE), dict(BASE, instruction_id=21, spc_cycles_end=40)]
        b = [dict(BASE), dict(BASE, instruction_id=20, spc_cycles_end=40)]
        r = mod.compare(a, b)
        self.assertFalse(r['logical_sequence_matches'])
        self.assertEqual('instruction_id', r['first_mismatch']['field'])
        self.assertEqual(1, r['first_mismatch']['event_index'])

    def test_mismatched_count(self):
        r = mod.compare([dict(BASE)], [])
        self.assertEqual('event_count', r['first_mismatch']['field'])
        self.assertEqual('not_comparable', r['physical_timing']['status'])

    def test_rejects_dropped_trace(self):
        p = self.csv('dropped.csv', [dict(BASE)], '# dropped=2; trace_schema=2')
        with self.assertRaisesRegex(mod.InvalidTrace, 'dropped'):
            mod.read_trace(p)

    def test_rejects_fake_microcycle(self):
        p = self.csv('fake.csv', [dict(BASE, physical_write_cycle=3)])
        with self.assertRaisesRegex(mod.InvalidTrace, 'provenance'):
            mod.read_trace(p)

    def test_real_cycle_comparison_only_when_explicit(self):
        x = [dict(BASE, physical_write_cycle=3, timing_provenance='cycle_accurate_reference')]
        y = [dict(BASE, physical_write_cycle=4, timing_provenance='hardware')]
        r = mod.compare(mod.read_trace(self.csv('a.csv', x)), mod.read_trace(self.csv('b.csv', y)))
        self.assertEqual('mismatch', r['physical_timing']['status'])
        self.assertEqual(0, r['physical_timing']['event_index'])

    def test_invalid_order_and_bounds(self):
        for event in [dict(BASE, access_ordinal=5), dict(BASE, accepted=3), dict(BASE, pc=-1)]:
            with self.assertRaises(mod.InvalidTrace):
                mod.read_trace(self.csv('bad.csv', [event]))
        with self.assertRaisesRegex(mod.InvalidTrace, 'backward'):
            mod.read_trace(self.csv('back.csv', [dict(BASE), dict(BASE, instruction_id=18)]))

    def test_legacy_53_csv_supported(self):
        legacy = {k: v for k, v in BASE.items() if k not in ('instruction_id', 'spc_cycles_end')}
        self.assertEqual(1, len(mod.read_trace(self.csv('legacy.csv', [legacy]))))

if __name__ == '__main__':
    unittest.main(verbosity=2)
