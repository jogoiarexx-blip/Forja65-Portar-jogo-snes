import unittest,importlib.util
from pathlib import Path
s=importlib.util.spec_from_file_location('race_gate',Path(__file__).with_name('verify_race_gate_rev147.py'))
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class TestGate(unittest.TestCase):
    def test_not_classified_even_if_lap_resets(self):
        x={'finish':{'laps':5,'rank':6,'course_id':3},'post_finish':{'course_id':3,'lap_reset':True,'frame':27920}}
        self.assertEqual(m.validate(x)['status'],'FINISHED_NOT_QUALIFIED')
    def test_no_course_change(self):
        x={'finish':{'laps':5,'rank':3,'course_id':3},'post_finish':{'course_id':3,'frame':27920,'screenshot_verified':True}}
        self.assertEqual(m.validate(x)['status'],'SAME_COURSE_RESTART_OR_RETRY')
    def test_missing_rank(self):
        self.assertEqual(m.validate({'finish':{'laps':5}})['status'],'RANK_UNVERIFIED')
    def test_unconfirmed_image(self):
        x={'finish':{'laps':5,'rank':3,'course_id':3,'frame':27000},'post_finish':{'course_id':4,'frame':27920}}
        self.assertEqual(m.validate(x)['status'],'NEXT_COURSE_VISUAL_NOT_VERIFIED')
    def test_valid_observed_transition(self):
        x={'finish':{'laps':5,'rank':3,'course_id':3,'frame':27000},'post_finish':{'course_id':4,'frame':27920,'screenshot_verified':True}}
        self.assertTrue(m.validate(x)['stage_advanced'])
    def test_nonmonotonic(self):
        x={'finish':{'laps':5,'rank':3,'course_id':3,'frame':27000},'post_finish':{'course_id':4,'frame':26000,'screenshot_verified':True}}
        self.assertEqual(m.validate(x)['status'],'NONMONOTONIC_OBSERVATION')
if __name__=='__main__':unittest.main()
