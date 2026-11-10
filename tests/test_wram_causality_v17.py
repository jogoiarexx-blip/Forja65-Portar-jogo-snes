#!/usr/bin/env python3
"""Positive, negative and truncation regression tests for differential WRAM evidence."""
import csv
import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_causality_v17 import compare,parse,first_trace_fork
HEAD='kind,frame,wram_address,old_value,new_value,changed,emitted,truncated,joy1,nmi,pc\n'

def dump(path, pre='10', post='20', truncated=False):
    content=HEAD+'baseline,2000,,,,0,0,0,0,0,0\n'
    content+=f'delta,2060,7E1234,0,{pre},1,1,0,0,0,A0123\n'
    content+='summary,2060,,,,1,1,0,0,0,A0123\n'
    content+=f'delta,2080,7E1234,{pre},{post},1,1,0,32768,0,A0123\n'
    content+=f'summary,2080,,,,{2 if truncated else 1},1,{1 if truncated else 0},32768,0,A0123\n'
    path.write_text(content)

class TestWramCausality(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.a=Path(self.tmp.name)/'base.csv';self.b=Path(self.tmp.name)/'variant.csv'
        dump(self.a);dump(self.b,post='21')
    def test_first_trace_fork(self):
        self.a.write_text('frame=950 joy1=1000 joy2=0000\nframe=960 joy1=0000 joy2=0000\nframe=2100 joy1=0000 joy2=0000\n')
        self.b.write_text('frame=950 joy1=1000 joy2=0000\nframe=960 joy1=0000 joy2=0000\nframe=2070 joy1=0200 joy2=0000\n')
        self.assertEqual(first_trace_fork(self.a,self.b),2070)
    def test_identical_trace(self):
        self.a.write_text('frame=2000 joy1=0000 joy2=0000\n')
        self.b.write_text(self.a.read_text())
        self.assertIsNone(first_trace_fork(self.a,self.b))
    def test_trace_order_violations(self):
        self.a.write_text('frame=20 joy1=0000 joy2=0000\nframe=19 joy1=0000 joy2=0000\n')
        self.b.write_text('frame=20 joy1=0000 joy2=0000\n')
        with self.assertRaisesRegex(ValueError,'unordered'):first_trace_fork(self.a,self.b)
    def test_valid_comparison(self):
        r=compare(self.a,self.b,2070)
        self.assertTrue(r['pre_fork_equal'])
        self.assertEqual(r['candidate_count'],1)
        self.assertEqual(r['candidates'][0]['address'],'7E1234')
        self.assertFalse(r['validated']['score'])
        self.assertTrue(r['validated']['input_effect_on_wram'])
    def test_pre_fork_mismatch_rejected(self):
        dump(self.b,pre='11')
        with self.assertRaisesRegex(ValueError,'pre-fork'):compare(self.a,self.b,2070)
    def test_fork_before_baseline_rejected(self):
        with self.assertRaisesRegex(ValueError,'fork'):compare(self.a,self.b,1990)
    def test_fork_after_last_rejected(self):
        with self.assertRaisesRegex(ValueError,'fork'):compare(self.a,self.b,3000)
    def test_truncation_never_confirms(self):
        dump(self.b,post='21',truncated=True)
        r=compare(self.a,self.b,2070)
        self.assertFalse(r['evidence_complete'])
        self.assertFalse(r['validated']['input_effect_on_wram'])
    def test_duplicate_address_rejected(self):
        s=self.b.read_text();s=s.replace('summary,2080','delta,2080,7E1234,10,22,1,1,0,32768,0,A0123\nsummary,2080')
        self.b.write_text(s)
        with self.assertRaisesRegex(ValueError,'duplicate address'):parse(self.b)
    def test_missing_summary_rejected(self):
        s=self.b.read_text().replace('summary,2080,,,,1,1,0,32768,0,A0123\n','')
        self.b.write_text(s)
        with self.assertRaises(ValueError):parse(self.b)
    def test_bad_ram_range_rejected(self):
        self.b.write_text(self.b.read_text().replace('7E1234','801234'))
        with self.assertRaisesRegex(ValueError,'invalid WRAM'):parse(self.b)
    def test_inconsistent_summary_rejected(self):
        self.b.write_text(self.b.read_text().replace('summary,2080,,,,1,1,0','summary,2080,,,,2,1,0'))
        with self.assertRaisesRegex(ValueError,'summary'):parse(self.b)
    def test_different_sample_frames_rejected(self):
        self.b.write_text(self.b.read_text().replace('2080','2090'))
        with self.assertRaisesRegex(ValueError,'sample frames'):compare(self.a,self.b,2070)
    def test_pre_fork_count_required(self):
        with self.assertRaisesRegex(ValueError,'pre-fork checkpoint'):compare(self.a,self.b,2060)

if __name__=='__main__':unittest.main(verbosity=2)
