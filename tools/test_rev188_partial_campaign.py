#!/usr/bin/env python3
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

P = Path(__file__).parent / 'verify-native-campaign.py'
spec = importlib.util.spec_from_file_location('verify_aot_campaign', P)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class PartialRunTests(unittest.TestCase):
    def test_partial_records_are_scoped_to_complete_frames(self):
        with tempfile.TemporaryDirectory() as t:
            d=Path(t)
            (d/'frame-hashes.txt').write_text('frame=0 framebuffer=aa wram=bb pc=1234\nframe=1 framebuffer=cc wram=dd pc=5678\n')
            (d/'stage.csv').write_text('# stage probe\nframe,reason,room,level,x,y,lives,pc\n60,periodic,43,43,100,200,5,b7cfa2\n')
            (d/'forja65-aot-frontier.txt').write_text('B6AAB0 M0X0 from=B6A89A count=1\n')
            p=audit.partial_run_evidence(d)
            self.assertEqual(p['verified_prefix_frames'],2)
            self.assertEqual(p['last_hashed_frame'],1)
            self.assertEqual(p['last_stage_sample']['room'],'43')
            self.assertIn('B6AAB0',p['aot_frontier'])
    def test_gaps_are_not_silently_certified(self):
        with tempfile.TemporaryDirectory() as t:
            d=Path(t)
            (d/'frame-hashes.txt').write_text('frame=0 framebuffer=aa wram=bb pc=1234\nframe=2 framebuffer=aa wram=cc pc=5678\n')
            p=audit.partial_run_evidence(d)
            self.assertEqual(p['verified_prefix_frames'],1)
            self.assertIsNotNone(p['partial_evidence_error'])
    def test_completed_manifest_requires_all_hashes(self):
        import json
        with tempfile.TemporaryDirectory() as t:
            d=Path(t)
            seg=d/'segment-0000';seg.mkdir()
            (seg/'frame-hashes.txt').write_text('frame=0 framebuffer=aa wram=bb pc=1234\n')
            (seg/'forja65-qa-status.txt').write_text('frames=2\n')
            (seg/'forja65-cpu-migration.txt').write_text('total_instructions=100\ninterpreter_instructions=0\n')
            manifest={'status':'complete','settings':{'frames':2,'mode':'aot','profile':'reference',
                      'trace_sha256':'aaa','game_sha256':'bbb','fallback_counter':'reset'},
                      'segments':[{'folder':'segment-0000','frame':2}]}
            (d/'manifest.json').write_text(json.dumps(manifest))
            self.assertFalse(audit.audit(d)['all_segments_verified'])

    def test_failure_never_claims_gameplay_success(self):
        with tempfile.TemporaryDirectory() as t:
            d=Path(t)
            (d/'game.log').write_text('FORJA65_CPU_AOT_ONLY missing\n')
            (d/'frame-hashes.txt').write_text('frame=0 framebuffer=aa wram=bb pc=1234\n')
            p=audit.classify_failure(2,d/'game.log',d/'frame-progress.csv',False,False)
            self.assertEqual(p['reason'],'aot_route_missing')
            self.assertFalse(p['gameplay_completed'])
            self.assertEqual(p['partial']['verified_prefix_frames'],1)

if __name__=='__main__': unittest.main()
