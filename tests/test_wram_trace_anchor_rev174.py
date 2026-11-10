"""Regression: pre-fork snapshots can precede the start of filtered writes."""
import csv
import sys
import tempfile
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_trace_core_v23 import verify_session,compare_pair

ADDR='7E087A'

def fixture(folder, *, change=2, corrupt=False):
 folder.mkdir(parents=True,exist_ok=True)
 (folder/'forja65-qa-status.txt').write_text('rom=TESTROM\nframes=3000\nruntime_started=PASS\n')
 (folder/'writers.csv').write_text('frame,address,old,new,writer_pc,bus,joy1,nmi\n'
     +('2100,7E087A,1,2,80E530,bus,0,0\n' if not corrupt else ''))
 with (folder/'snapshots.csv').open('w',newline='') as fd:
  w=csv.writer(fd);w.writerow(['frame','file','pc','joy1','bytes'])
  for frame,val in [(2050,0),(2099,1),(2100,change),(2999,change)]:
   data=bytearray(131072);data[int(ADDR,16)-0x7e0000]=val
   name=f'wram-{frame:08d}.bin';(folder/name).write_bytes(data)
   w.writerow([frame,name,'80E530',0,131072])

class TraceAnchorTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name)
 def test_last_pre_window_anchor_handles_earlier_change(self):
  folder=self.root/'test';fixture(folder)
  x=verify_session(folder,[ADDR],2100,2999,50,3000)
  self.assertEqual(x['checkpoints'],[2099,2100,2999])
  self.assertEqual(x['anchor_frame'],2099)
  self.assertEqual(x['event_count'],1)
 def test_lost_write_is_still_rejected(self):
  folder=self.root/'test';fixture(folder,corrupt=True)
  with self.assertRaisesRegex(ValueError,'writer log cannot explain'):
   verify_session(folder,[ADDR],2100,2999,50,3000)
 def test_different_prefork_rejected(self):
  left=self.root/'a';right=self.root/'b';fixture(left);fixture(right)
  data=bytearray((right/'wram-00002050.bin').read_bytes());data[7]=99
  (right/'wram-00002050.bin').write_bytes(data)
  with self.assertRaisesRegex(ValueError,'pre-fork'):
   compare_pair(left,right,[ADDR],2100,2999,50,3000,2100)

class AsymmetricPreWindowTests(unittest.TestCase):
 def test_missing_or_extra_pre_window_snapshot_rejected(self):
  for side in ('control','attack'):
   with self.subTest(side=side), tempfile.TemporaryDirectory() as tmp:
    left=Path(tmp)/'a';right=Path(tmp)/'b';fixture(left);fixture(right)
    selected=left if side=='control' else right
    manifest=selected/'snapshots.csv'
    lines=manifest.read_text().splitlines()
    manifest.write_text('\n'.join(line for line in lines if not line.startswith('2050,'))+'\n')
    with self.assertRaisesRegex(ValueError,'snapshot frame|checkpoint'):
     compare_pair(left,right,[ADDR],2100,2999,50,3000,2100)
 def test_extra_pre_window_snapshot_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   left=Path(tmp)/'a';right=Path(tmp)/'b';fixture(left);fixture(right)
   (right/'wram-00002051.bin').write_bytes(bytes(131072))
   manifest=right/'snapshots.csv'
   lines=manifest.read_text().splitlines()
   lines.insert(2,'2051,wram-00002051.bin,80E530,0,131072')
   manifest.write_text('\n'.join(lines)+'\n')
   with self.assertRaisesRegex(ValueError,'snapshot frame|checkpoint'):
    compare_pair(left,right,[ADDR],2100,2999,50,3000,2100)

if __name__=='__main__':unittest.main()
