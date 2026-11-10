import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path
path=Path(__file__).resolve().parent.parent/'tools'/'replay-differential-audit.py'
spec=importlib.util.spec_from_file_location('replay_diff',path)
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

class DifferentialTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.dir=Path(self.temp.name)
        self.a=self.dir/'a.csv';self.b=self.dir/'b.csv'
    def tearDown(self):self.temp.cleanup()
    def write(self,path,vals):
        with path.open('w',newline='') as f:
            writer=csv.writer(f);writer.writerow(['frame','pc','joy1','autojoy1','instructions','nmi','fb_fnv1a64'])
            for i,(joy,hash_) in enumerate(vals,1):writer.writerow([i,'c01000',joy,joy,i*100,i,hash_])
    def test_diff_after_button(self):
        self.write(self.a,[('0','a'),('0','a'),('0','a')]);self.write(self.b,[('0','a'),('8000','a'),('8000','b')])
        d=audit.compare(self.a,self.b)
        self.assertEqual((d['first_input_difference'],d['first_image_difference']),(2,3))
        self.assertFalse(d['gameplay_verified'])
    def test_button_no_image(self):
        self.write(self.a,[('0','a'),('0','a')]);self.write(self.b,[('0','a'),('8000','a')])
        self.assertEqual(audit.compare(self.a,self.b)['status'],'input_applied_no_visual_difference')
    def test_identical(self):
        self.write(self.a,[('0','a')]);self.write(self.b,[('0','a')])
        self.assertEqual(audit.compare(self.a,self.b)['status'],'no_input_difference')
    def test_no_shared_window(self):
        self.write(self.a,[('0','a')]);self.write(self.b,[('0','a')])
        self.assertEqual(audit.compare(self.a,self.b,start=100)['status'],'no_shared_frames')
    def test_invalid_duplicate(self):
        self.write(self.a,[('0','a')]);self.write(self.b,[('0','a')])
        with self.a.open('a') as f:f.write('1,c01000,0,0,100,1,a\n')
        with self.assertRaises(ValueError):audit.compare(self.a,self.b)
    def test_prefix_diverges(self):
        self.write(self.a,[('0','a'),('0','a'),('0','a')]);self.write(self.b,[('0','b'),('8000','a'),('8000','b')])
        self.assertEqual(audit.compare(self.a,self.b)['status'],'baseline_diverged_before_input')
    def test_video_pairs_required(self):
        self.write(self.a,[('0','a'),('8000','b')]);self.write(self.b,[('0','a'),('0','b')])
        with self.assertRaises(ValueError):audit.compare(self.a,self.b,a_video=self.a)
    def test_video_comparison(self):
        self.write(self.a,[('0','a'),('0','a'),('0','a')]);self.write(self.b,[('0','a'),('8000','a'),('8000','b')])
        hdr=list(audit.VIDEO_COLUMNS)
        for path,changed in ((self.dir/'av.csv',False),(self.dir/'bv.csv',True)):
            with path.open('w',newline='') as f:
                writer=csv.writer(f);writer.writerow(hdr)
                for i in (1,2,3):writer.writerow([i,'a','a','a','a' if not changed or i!=3 else 'b','a','0','0'])
        out=audit.compare(self.a,self.b,a_video=self.dir/'av.csv',b_video=self.dir/'bv.csv')
        self.assertEqual(out['first_video_difference']['cgram'],3)

if __name__=='__main__':unittest.main()
