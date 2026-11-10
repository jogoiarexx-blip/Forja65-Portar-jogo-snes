#!/usr/bin/env python3
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).with_name('certify-native-route.py')
spec = importlib.util.spec_from_file_location('native_route_certification', MODULE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class CertificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.p = Path(self.tmp.name)
        (self.p/'segment-0000').mkdir()
        self.golden = self.p/'golden'
        self.golden.write_text('frame=1 wram=bbbb # boss entered\n')
        (self.p/'segment-0000'/'frame-hashes.txt').write_text('frame=0 framebuffer=aaaa wram=aaaa pc=123456\nframe=1 framebuffer=bbbb wram=bbbb pc=567890\n')
        (self.p/'segment-0000'/'exit-code.txt').write_text('0\n')
        (self.p/'segment-0000'/'forja65-cpu-migration.txt').write_text('total_instructions=123\ninterpreter_instructions=0\n')
        (self.p/'segment-0000'/'forja65-qa-status.txt').write_text('frames=2\n')
        (self.p/'manifest.json').write_text(json.dumps({'status':'complete','settings':{'mode':'aot','frames':2}, 'segments':[{'folder':'segment-0000','frame':2}]}))
        (self.p/'audit.json').write_text(json.dumps({'frames':2,'all_segments_verified':True,'cpu_instructions':123,'interpreted_instructions':0}))
    def test_valid_aot_route(self):
        r=m.certify(self.p,self.golden,expected_frames=2)
        self.assertTrue(r['strict_cpu_aot_certified'])
        self.assertEqual(r['matched_milestones'],1)
    def test_rejects_inconsistent_raw_cpu_counts(self):
        (self.p/'segment-0000'/'forja65-cpu-migration.txt').write_text('total_instructions=123\ninterpreter_instructions=1\n')
        r=m.certify(self.p,self.golden,expected_frames=2)
        self.assertFalse(r['strict_cpu_aot_certified'])
        self.assertIn('raw_cpu_audit_disagreement', [x['type'] for x in r['divergences']])

    def test_rejects_interpreted_cpu(self):
        audit=json.loads((self.p/'audit.json').read_text());audit['interpreted_instructions']=1
        (self.p/'audit.json').write_text(json.dumps(audit))
        self.assertFalse(m.certify(self.p,self.golden,expected_frames=2)['strict_cpu_aot_certified'])
    def test_rejects_missing_frames(self):
        (self.p/'segment-0000'/'frame-hashes.txt').write_text('frame=0 framebuffer=aaaa wram=aaaa pc=123456\n')
        self.assertFalse(m.certify(self.p,self.golden,expected_frames=2)['strict_cpu_aot_certified'])
    def test_rejects_incorrect_golden(self):
        self.golden.write_text('frame=1 wram=cccc # boss entered\n')
        r=m.certify(self.p,self.golden,expected_frames=2)
        self.assertFalse(r['strict_cpu_aot_certified']);self.assertEqual(r['divergences'][0]['type'],'golden_wram')
    def test_rejects_incorrect_mode(self):
        manifest=json.loads((self.p/'manifest.json').read_text());manifest['settings']['mode']='normal';(self.p/'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaises(ValueError): m.certify(self.p,self.golden)
    def test_blocked_run_reports_correct_reason(self):
        manifest=json.loads((self.p/'manifest.json').read_text())
        manifest['status']='blocked'
        manifest['failure']={'reason':'native_return_mismatch'}
        manifest['segments']=[]
        (self.p/'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError,'native_return_mismatch'):
            m.certify(self.p,self.golden)

    def test_rejects_checkpoint_segmentation(self):
        manifest=json.loads((self.p/'manifest.json').read_text());manifest['segments'].append({'folder':'segment-0001','frame':2});(self.p/'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaises(ValueError): m.certify(self.p,self.golden)
    def test_rejects_corrupt_order(self):
        (self.p/'segment-0000'/'frame-hashes.txt').write_text('frame=0 framebuffer=aaaa wram=aaaa pc=123456\nframe=2 framebuffer=bbbb wram=bbbb pc=567890\n')
        with self.assertRaises(ValueError):m.certify(self.p,self.golden)
    def test_rejects_wrong_trace_identity(self):
        trace=self.p/'trace';trace.write_text('anything')
        with self.assertRaises(ValueError):m.certify(self.p,self.golden,trace=trace)
    def test_rejects_short_baseline_when_prefix_required(self):
        base=self.p/'base';base.write_text('frame=0 framebuffer=aaaa wram=aaaa pc=123456\n')
        r=m.certify(self.p,self.golden,baseline=base,baseline_required=2)
        self.assertFalse(r['strict_cpu_aot_certified'])
        self.assertEqual(r['divergences'][0]['type'],'baseline_incomplete')

    def test_baseline_mismatch(self):
        base=self.p/'base';base.write_text('frame=0 framebuffer=abcd wram=aaaa pc=123456\n')
        r=m.certify(self.p,self.golden,baseline=base)
        self.assertFalse(r['strict_cpu_aot_certified']);self.assertEqual(r['divergences'][0]['type'],'baseline')

if __name__=='__main__': unittest.main()
