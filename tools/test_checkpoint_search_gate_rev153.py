import copy, tempfile, unittest, hashlib
from pathlib import Path
from checkpoint_search_gate_rev153 import audit

class SectorGateTests(unittest.TestCase):
    def setUp(self):
        self.d=tempfile.TemporaryDirectory();self.addCleanup(self.d.cleanup)
        self.path=Path(self.d.name)/'trial.trace'
        self.path.write_text('# FORJA65_INPUT_TRACE 1\nframe=1 joy1=0000 joy2=0000\nframe=20 joy1=8000 joy2=0000\n')
        sha=hashlib.sha256(self.path.read_bytes()).hexdigest()
        self.data={'rom_sha256':'a'*64,'source_trace_sha256':'b'*64,'start_wram_sha256':'c'*64,
              'trace_sha256':sha,'finish_frame':30,'five_laps_observed':False,
              'segments':[{'n':0,'start_progress':1,'goal':8,'ahead':10,'frame':30,'progress':8,'target_met':True,
                'trials':[{'ahead':6,'target_met':True,'progress':8,'frames':60,'frame':60,'rejected_shortcuts':1},
                          {'ahead':10,'target_met':True,'progress':8,'frames':30,'frame':30,'rejected_shortcuts':1}]}]}
    def test_valid_evidence_rank_unverified(self):
        result=audit(self.data,self.path)
        self.assertEqual(result['status'],'SEARCH_EVIDENCE_VALID')
        self.assertEqual(result['classification'],'UNVERIFIED')
    def test_wrong_selected_candidate(self):
        d=copy.deepcopy(self.data);d['segments'][0]['ahead']=6
        self.assertEqual(audit(d)['status'],'SEARCH_EVIDENCE_INVALID')
    def test_forged_progress(self):
        d=copy.deepcopy(self.data);d['segments'][0]['progress']=100
        self.assertEqual(audit(d)['status'],'SEARCH_EVIDENCE_INVALID')
    def test_discontinuity(self):
        d=copy.deepcopy(self.data);s=copy.deepcopy(d['segments'][0]);s.update(n=1,start_progress=9,goal=16,progress=16,frame=90)
        d['segments'].append(s)
        self.assertEqual(audit(d)['status'],'SEARCH_EVIDENCE_INVALID')
    def test_trace_tampering(self):
        self.path.write_text(self.path.read_text()+'frame=21 joy1=0100 joy2=0000\n')
        self.assertIn('replay SHA-256 mismatch',audit(self.data,self.path)['errors'])
    def test_nonmonotonic_trace(self):
        self.path.write_text('frame=20 joy1=8000 joy2=0000\nframe=10 joy1=0000 joy2=0000\n')
        self.data['trace_sha256']=hashlib.sha256(self.path.read_bytes()).hexdigest()
        self.assertTrue(any('timeline' in x for x in audit(self.data,self.path)['errors']))
    def test_false_five_laps(self):
        d=copy.deepcopy(self.data);d['five_laps_observed']=True;d['end_racer']={'lap':4}
        self.assertEqual(audit(d)['status'],'SEARCH_EVIDENCE_INVALID')
    def test_last_checkpoint_is_not_finish(self):
        d=copy.deepcopy(self.data);s=d['segments'][0];s.update(start_progress=168,goal=170,progress=170,frame=50)
        s['trials']=[{'ahead':10,'progress':170,'target_met':True,'lap':4,'frame':50,'frames':20,'rejected_shortcuts':0}]
        d['finish_frame']=50
        self.assertIn('progress 170 without observed lap 5',' | '.join(audit(d)['errors']))
    def test_no_segments(self):
        d=copy.deepcopy(self.data);d['segments']=[]
        self.assertEqual(audit(d)['status'],'SEARCH_EVIDENCE_INVALID')
if __name__=='__main__':unittest.main()
