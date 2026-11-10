"""Synthetic, game-neutral WRAM trace/snapshot regression tests."""
import csv,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_trace_core_v23 import verify_session,compare_pair,HEADER

ADDRESS='7E0040'
def prepare(p,changed=False):
 p.mkdir(exist_ok=True)
 (p/'forja65-qa-status.txt').write_text('rom=ROM\nframes=20\nruntime_started=PASS\n')
 with (p/'writers.csv').open('w',newline='') as f:
  w=csv.writer(f);w.writerow(HEADER)
  if changed:w.writerow([12,ADDRESS,0,7,'80ABCD','bus',0,0])
 with (p/'snapshots.csv').open('w',newline='') as f:
  w=csv.writer(f);w.writerow(['frame','file','pc','joy1','bytes'])
  for i in [9,11,12,15]:
   m=bytearray(131072)
   if changed and i>=12:m[0x40]=7
   fn=f'wram-{i:08d}.bin';(p/fn).write_bytes(m)
   w.writerow([i,fn,'80ABCD',0,131072])

class PortableAudit(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup)
  r=Path(t.name);self.b=r/'b';self.a=r/'a';prepare(self.b);prepare(self.a,True)
 def test_pair(self):
  r=compare_pair(self.b,self.a,[ADDRESS],10,15,200,20,12)
  self.assertEqual(r['attack']['event_count'],1)
  self.assertEqual(r['control']['event_count'],0)
  self.assertFalse(r['attack']['validated']['score'])
 def test_no_writes_can_be_valid(self):
  self.assertEqual(verify_session(self.b,[ADDRESS],10,15,200,20)['event_count'],0)
 def test_missing_writer_fails_closed(self):
  (self.a/'writers.csv').write_text(','.join(HEADER)+'\n')
  with self.assertRaisesRegex(ValueError,'cannot explain snapshot'):
   verify_session(self.a,[ADDRESS],10,15,200,20)
 def test_unmatched_premark_fails(self):
  p=self.a/'wram-00000011.bin';v=bytearray(p.read_bytes());v[900]=1;p.write_bytes(v)
  with self.assertRaisesRegex(ValueError,'pre-fork'):
   compare_pair(self.b,self.a,[ADDRESS],10,15,200,20,12)
 def test_writer_cap_fails(self):
  with self.assertRaisesRegex(ValueError,'cap'):
   verify_session(self.a,[ADDRESS],10,15,1,20)
 def test_invalid_address_fails(self):
  with self.assertRaisesRegex(ValueError,'address'):
   verify_session(self.a,['000040'],10,15,200,20)
if __name__=='__main__':unittest.main()
