"""Evidence tampering, course restart, ranking, and visual gate regression."""
import unittest, tempfile, hashlib
from pathlib import Path
from course_evidence_rev151 import check

class EvidenceGate(unittest.TestCase):
    def setUp(self):
        self.t=tempfile.TemporaryDirectory();self.root=Path(self.t.name)
        for name,data in {'finish.ppm':b'P6\n1 1\n255\nABC','next.ppm':b'P6\n1 1\n255\nDEF','score.ppm':b'P6\n1 1\n255\nGHI','race.trace':b'frame=0 joy1=0000 joy2=0000\n'}.items():
            (self.root/name).write_bytes(data)
        def spec(name):return {'path':name,'sha256':hashlib.sha256((self.root/name).read_bytes()).hexdigest()}
        self.data={'finish':{'lap':5,'rank':3,'course_id':'Ghost Valley 1','frame':26274,'screenshot':spec('finish.ppm'), 'official_result_screenshot':spec('score.ppm')},
                   'next_race':{'course_id':'Bowser Castle 1','frame':27934,'screenshot':spec('next.ppm'),
                                'visual_review':{'confirmed':True,'basis':'lava track and Round 4 screenshot manually inspected'}},
                   'input_trace':spec('race.trace'),'cold_replay_verified':True}
    def tearDown(self):self.t.cleanup()
    def status(self):return check(self.data,self.root)['status']
    def test_evidence_chain_ok(self):self.assertEqual(self.status(),'TRANSITION_EVIDENCE_INTEGRITY_OK')
    def test_scoreboard_tampered(self):(self.root/'score.ppm').write_bytes(b'different');self.assertEqual(self.status(),'INVALID_EVIDENCE')
    def test_cold_replay_flag_not_boolean(self):self.data['cold_replay_verified']='true';self.assertEqual(self.status(),'INDEPENDENT_REPLAY_MISSING')
    def test_unqualified_rejected(self):self.data['finish']['rank']=5;self.assertEqual(self.status(),'FINISHED_NOT_QUALIFIED')
    def test_restarted_same_course(self):self.data['next_race']['course_id']='Ghost Valley 1';self.assertEqual(self.status(),'SAME_COURSE_RESTART')
    def test_missing_visual_review(self):self.data['next_race'].pop('visual_review');self.assertEqual(self.status(),'VISUAL_REVIEW_MISSING')
    def test_missing_cold_replay(self):self.data['cold_replay_verified']=False;self.assertEqual(self.status(),'INDEPENDENT_REPLAY_MISSING')
    def test_tampered_screenshot(self):(self.root/'next.ppm').write_bytes(b'changed');self.assertEqual(self.status(),'INVALID_EVIDENCE')
    def test_tampered_trace(self):(self.root/'race.trace').write_bytes(b'changed');self.assertEqual(self.status(),'INVALID_EVIDENCE')
    def test_path_traversal_rejected(self):self.data['input_trace']['path']='../bad.trace';self.assertEqual(self.status(),'INVALID_EVIDENCE')
    def test_wrong_frame_order(self):self.data['next_race']['frame']=1;self.assertEqual(self.status(),'INVALID_EVIDENCE')
    def test_same_image_reused(self):self.data['next_race']['screenshot']=self.data['finish']['screenshot'];self.assertEqual(self.status(),'INVALID_EVIDENCE')
    def test_bad_rank_bool(self):self.data['finish']['rank']=True;self.assertEqual(self.status(),'INVALID_EVIDENCE')
if __name__=='__main__':unittest.main()
