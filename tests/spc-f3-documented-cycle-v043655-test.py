#!/usr/bin/env python3
"""Tests of bus-table annotations. These are not hardware trace measurements."""
import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'spc_f3_trace_diff.py'
spec = importlib.util.spec_from_file_location('f3diff55', MODULE)
diff = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diff)

BASE = {'pc':'768', 'opcode':'218', 'dsp_addr':'108', 'value':'32',
        'accepted':'1','instruction_cycles':'5','instruction_id':'1',
        'spc_cycles_end':'5','access_ordinal':'3','logical_accesses':'4'}

class CycleAnnotationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='f3-annotated-test55-')
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'trace.csv'

    def trace(self, **fields):
        row = {**BASE, **fields}
        with self.path.open('w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=list(row))
            w.writeheader(); w.writerow(row)
        return diff.read_trace(self.path)

    def test_cycle_four_is_documented_not_physical(self):
        t = self.trace(documented_write_cycle='4', timing_source='spc700_commands_2014_table_1_1_6d')
        report=diff.compare(t,t)
        self.assertTrue(report['logical_sequence_matches'])
        self.assertEqual(report['physical_timing']['status'],'not_comparable')
        self.assertEqual(t[0]['documented_write_cycle'],4)

    def test_cycle_five_for_high_byte(self):
        t=self.trace(documented_write_cycle='5', timing_source='spc700_commands_2014_table_1_1_6d')
        self.assertEqual(t[0]['documented_write_cycle'],5)

    def test_annotation_first_difference_detected(self):
        a=self.trace(documented_write_cycle='4', timing_source='spc700_commands_2014_table_1_1_6d')
        b=self.trace(documented_write_cycle='5', timing_source='spc700_commands_2014_table_1_1_6d')
        self.assertEqual(diff.compare(a,b)['first_mismatch']['field'],'documented_write_cycle')

    def test_rejects_impossible_or_unattributed_annotations(self):
        for update in [{'documented_write_cycle':'7', 'timing_source':'spc700_commands_2014_table_1_1_6d'},
                       {'documented_write_cycle':'4', 'timing_source':'unknown'},
                       {'documented_write_cycle':'4', 'timing_source':'spc700_commands_2014_table_1_1_6d','instruction_cycles':'4'},
                       {'documented_write_cycle':'4', 'timing_source':'spc700_commands_2014_table_1_1_6d','opcode':'143'}]:
            with self.subTest(update=update):
                with self.assertRaises(diff.InvalidTrace):self.trace(**update)

    def test_legacy_trace_is_still_readable(self):
        t=self.trace()
        self.assertNotIn('documented_write_cycle',t[0])
        self.assertTrue(diff.compare(t,t)['logical_sequence_matches'])

if __name__=='__main__':unittest.main(verbosity=2)
