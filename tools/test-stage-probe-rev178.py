#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path
SCRIPT=Path(__file__).resolve().parent/'audit-stage-probe-rev178.py'
spec=importlib.util.spec_from_file_location('stage_audit',SCRIPT)
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
HEADER='# FORJA65_DKC3_STAGE_PROBE 1 rom=3a574807afbad761\n'+','.join(a.COLUMNS)+'\n'
def row(frame,room=50,x=10,y=20,interp=0,reason='periodic',level=50):
    return f'{frame},{reason},{room},{level},{x},{y},9,0,64,b9bc5b,{frame*100},{interp}\n'
class StageAuditTests(unittest.TestCase):
    def runfile(self,txt):
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/'trace.csv';p.write_text(txt)
            return a.parse_csv(p)
    def test_good_parsing(self):
        rom,rows=self.runfile(HEADER+row(10)+row(11,interp=20,reason='transition'))
        self.assertEqual(len(rows),2)
        self.assertEqual(rom,'3a574807afbad761')
    def test_reject_duplicate_frame(self):
        with self.assertRaisesRegex(ValueError,'non-monotonic'):
            self.runfile(HEADER+row(10)+row(10))
    def test_reject_interpreter_over_count(self):
        with self.assertRaisesRegex(ValueError,'interpreted > all'):
            self.runfile(HEADER+row(10,interp=1100))
    def test_reject_truncated_rows(self):
        with self.assertRaisesRegex(ValueError,'missing/extra'):
            self.runfile(HEADER+'10,periodic,1\n')
    def test_gate_without_room_not_completed(self):
        rom,rows=self.runfile(HEADER+row(1,room=6,level=6))
        report=a.audit(rom,rows,0x32)
        self.assertEqual(report['status'],'TARGET_ROOM_NOT_OBSERVED')
        self.assertFalse(report['completed'])
    def test_baseline_divergence(self):
        rom,rows=self.runfile(HEADER+row(1)+row(10,x=30))
        _,ref=self.runfile(HEADER+row(1)+row(10,x=10))
        report=a.audit(rom,rows,0x32,(rom,ref))
        self.assertEqual(report['comparison']['first_mismatch']['frame'],10)
        self.assertEqual(report['comparison']['status'],'DIVERGED')
    def test_no_overlap_not_equivalence(self):
        rom,rows=self.runfile(HEADER+row(1))
        _,ref=self.runfile(HEADER+row(2))
        self.assertEqual(a.audit(rom,rows,50,(rom,ref))['comparison']['status'],'NO_OVERLAPPING_SAMPLES')
    def test_regression_rejected(self):
        with self.assertRaisesRegex(ValueError,'counter regression'):
            self.runfile(HEADER+row(10,interp=100)+row(11,interp=50))
    def test_replay_provenance_matches(self):
        rom,rows=self.runfile(HEADER.replace('\n', ' replay=1111111111111111\n', 1)+row(10))
        _,baseline=self.runfile(HEADER.replace('\n', ' replay=1111111111111111\n', 1)+row(10))
        result=a.audit(rom,rows,50,(rom,baseline))
        self.assertTrue(result['comparison']['same_input_proven'])
        self.assertEqual(result['comparison']['status'],'MATCHED_SAMPLED_STATE')
    def test_different_replays_cannot_be_compared(self):
        rom,rows=self.runfile(HEADER.replace('\n', ' replay=1111111111111111\n', 1)+row(10))
        _,baseline=self.runfile(HEADER.replace('\n', ' replay=2222222222222222\n', 1)+row(10))
        self.assertEqual(a.audit(rom,rows,50,(rom,baseline))['comparison']['status'],'DIFFERENT_REPLAY_INPUTS')
    def test_legacy_replay_provenance_is_unverified(self):
        rom,rows=self.runfile(HEADER+row(10))
        _,baseline=self.runfile(HEADER+row(10))
        result=a.audit(rom,rows,50,(rom,baseline))
        self.assertFalse(result['comparison']['same_input_proven'])
        self.assertEqual(result['comparison']['status'],'SAMPLED_STATES_MATCH_INPUT_UNVERIFIED')
    def test_bad_metadata_rejected(self):
        with self.assertRaisesRegex(ValueError,'invalid schema'):
            self.runfile(HEADER.replace('\n',' replay=invalid\n',1)+row(10))
if __name__=='__main__':unittest.main()
