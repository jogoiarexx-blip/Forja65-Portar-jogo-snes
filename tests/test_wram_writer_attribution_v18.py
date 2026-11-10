import csv,json,tempfile,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_writer_attribution_v18 import build_report,writer_log,load_candidate_report

class Writer(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  root=Path(self.tmp.name);self.c=root/'candidate.json';self.b=root/'base.csv';self.a=root/'attack.csv'
  self.c.write_text(json.dumps({'schema':'forja65.wram.causality/1','fork_frame':2070,'pre_fork_equal':True,
    'evidence_complete':True,'truncated_frame_count':0,'candidate_count':1,
    'candidates':[{'address':'7E0110','different_samples':4,'first_different_frame':2110}]}))
  self.base=[(2060,'7E0110',0,1,'80A010','bus',0,0),(2100,'7E0110',1,2,'80A010','bus',32768,1)]
  self.attack=[(2060,'7E0110',0,1,'80A010','bus',0,0),(2100,'7E0110',1,3,'80B020','bus',32768,1)]
  self.write()
 def write(self):
  for path,rows in ((self.b,self.base),(self.a,self.attack)):
   with path.open('w',newline='') as f:
    w=csv.writer(f);w.writerow(['frame','address','old','new','writer_pc','bus','joy1','nmi']);w.writerows(rows)
 def test_valid(self):
  r=build_report(self.c,self.b,self.a,2000,2300,10,10)
  self.assertEqual(r['addresses_with_actual_writer'],1)
  self.assertEqual(r['addresses'][0]['pc_only_in_attack'],['80B020'])
  self.assertEqual(r['addresses'][0]['first_attack_writes'][0]['new'],3)
  self.assertFalse(r['validated']['collision'])
 def test_pre_fork_writer_diff_is_error(self):
  self.attack[0]=(2060,'7E0110',0,4,'80A010','bus',0,0);self.write()
  with self.assertRaisesRegex(ValueError,'pre-fork'):build_report(self.c,self.b,self.a,2000,2300,10,10)
 def test_truncated_report_rejected(self):
  d=json.loads(self.c.read_text());d['evidence_complete']=False;self.c.write_text(json.dumps(d))
  with self.assertRaisesRegex(ValueError,'complete matched'):build_report(self.c,self.b,self.a,2000,2300,10,10)
 def test_writer_cap_rejected(self):
  with self.assertRaisesRegex(ValueError,'cap'):build_report(self.c,self.b,self.a,2000,2300,2,10)
 def test_out_of_order(self):
  self.attack.reverse();self.write()
  with self.assertRaisesRegex(ValueError,'unordered'):writer_log(self.a)
 def test_bad_bus(self):
  self.attack[0]=(2060,'7E0110',0,1,'80A010','wram',0,0);self.write()
  with self.assertRaisesRegex(ValueError,'unknown writer bus'):writer_log(self.a)
 def test_empty_file(self):
  self.attack=[];self.write()
  with self.assertRaisesRegex(ValueError,'no WRAM'):writer_log(self.a)

if __name__=='__main__':unittest.main(verbosity=2)
