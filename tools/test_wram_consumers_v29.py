import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('wram_consumers_v29',Path(__file__).parent/'wram_consumers_v29.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class TestConsumers(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory(); self.addCleanup(self.t.cleanup)
  self.w=Path(self.t.name)/'writers.csv';self.r=Path(self.t.name)/'reads.csv'
  self.write([
   ['2100','7E0AAE','0','1','80A060','bus','32768','0'],
   ['2101','7E0866','3','4','809ED5','bus','0','0']])
  self.read([
   ['2100','7E0AAE','1','80A070','bus','32768','0'],
   ['2101','7E0AAE','1','80A080','bus','0','0'],
   ['2102','7E0866','4','809EF0','2180','0','0']])
 def write(self, rows):
  with self.w.open('w',newline='') as f:
   w=csv.writer(f);w.writerow(['frame','address','old','new','writer_pc','bus','joy1','nmi']);w.writerows(rows)
 def read(self, rows):
  with self.r.open('w',newline='') as f:
   w=csv.writer(f);w.writerow(['frame','address','value','reader_pc','via','joy1','nmi']);w.writerows(rows)
 def test_prior_frame_only(self):
  d=mod.analyze(self.w,self.r,2100,2102)
  self.assertEqual(d['compatible_prior_frame_reads'],2)
  self.assertEqual(d['same_frame_ambiguous'],1)
  self.assertEqual(d['validated']['collision'],False)
  self.assertEqual(d['compatible_pairs'][0]['writer_pc'],'809ED5')
 def test_incomplete_value_not_proven(self):
  self.read([['2102','7E0866','9','809EF0','bus','0','0']]);d=mod.analyze(self.w,self.r,2100,2102)
  self.assertEqual(d['value_mismatch_or_incomplete_writes'],1);self.assertEqual(d['compatible_pairs'],[])
 def test_reversed_window(self):
  with self.assertRaises(ValueError):mod.analyze(self.w,self.r,2104,2100)
 def test_wrong_header_rejected(self):
  self.r.write_text('frame,address,value\n2100,7E0AAE,1\n')
  with self.assertRaises(ValueError):mod.analyze(self.w,self.r,2100,2102)
 def test_out_of_order_rejected(self):
  self.read([['2102','7E0AAE','1','80A080','bus','0','0'],['2100','7E0AAE','1','80A081','bus','0','0']])
  with self.assertRaises(ValueError):mod.analyze(self.w,self.r,2100,2102)
 def test_invalid_address_rejected(self):
  self.read([['2102','810AAE','1','80A080','bus','0','0']])
  with self.assertRaises(ValueError):mod.analyze(self.w,self.r,2100,2102)
 def test_window_bound_enforced(self):
  with self.assertRaises(ValueError):mod.analyze(self.w,self.r,2101,2102)
 def test_missing_file_rejected(self):
  self.r.unlink()
  with self.assertRaises(ValueError):mod.analyze(self.w,self.r,2100,2102)
if __name__=='__main__':unittest.main()
