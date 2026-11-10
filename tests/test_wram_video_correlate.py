import csv,importlib.util,tempfile,unittest
from pathlib import Path
MODULE=Path(__file__).resolve().parents[1]/'tools'/'wram-video-correlate.py'
spec=importlib.util.spec_from_file_location('wram_video',MODULE)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class CorrelationTests(unittest.TestCase):
 def test_frame_join_and_no_false_confirmation(self):
  with tempfile.TemporaryDirectory() as td:
   w=Path(td)/'writes.csv';v=Path(td)/'video.csv'
   w.write_text('frame,address,old,new,writer_pc,bus,joy1,nmi\n10,7E1234,3,2,C0F923,bus,0,1\n11,7E1234,2,1,C0F923,bus,0,2\n',encoding='utf-8')
   v.write_text('frame,pc,framebuffer,joy1\n10,C0F923,ABC,0\n11,C0F923,DEF,0\n',encoding='utf-8')
   r=mod.correlate(w,v)
   self.assertFalse(r['get_ready_timer_confirmed'])
   self.assertEqual(r['addresses']['$7E1234']['decreases'],2)
   self.assertEqual(r['addresses']['$7E1234']['distinct_video_hashes_at_write_frames'],2)
 def test_reject_duplicate_video_frames(self):
  with tempfile.TemporaryDirectory() as td:
   w=Path(td)/'writes.csv';v=Path(td)/'video.csv'
   w.write_text('frame,address,old,new,writer_pc,joy1\n1,7E1234,1,0,C0F923,0\n')
   v.write_text('frame,pc,framebuffer,joy1\n1,AA,FF,0\n1,AA,FF,0\n')
   with self.assertRaises(ValueError):mod.correlate(w,v)
if __name__=='__main__':unittest.main()
