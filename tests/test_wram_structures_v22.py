"""Generic Forja65 structure-audit smoke tests (synthetic only)."""
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_structures_v22 import _motif,_runs
from targeted_writer_capture_v22 import plan
class GenericTriage(unittest.TestCase):
 def test_aligned_repeated_buffer(self):
  self.assertEqual(_motif(bytes.fromhex('00E0FFC5')*4)['repeats'],4)
 def test_nonrepeating_not_misclassified(self):
  self.assertIsNone(_motif(bytes(range(16))))
 def test_do_not_merge_bank_boundary(self):
  self.assertEqual(_runs([65534,65535,65536,65537]),[[65534,65535],[65536,65537]])
 def test_target_schema_validation(self):
  x={'schema':'forja65.wram.structure-triage/2',
      'new_targeted_writer_plan':{'addresses':['7E022E','7E0910'],'frames_start':10,'frames_end':20,'max_records':100}}
  self.assertEqual(plan(x)['addresses'],['7E022E','7E0910'])
  x['new_targeted_writer_plan']['addresses'].append('7E022E')
  with self.assertRaises(ValueError):plan(x)
 def test_no_fake_wram_addresses(self):
  x={'schema':'forja65.wram.structure-triage/2',
      'new_targeted_writer_plan':{'addresses':['00ABCD'],'frames_start':10,'frames_end':20,'max_records':100}}
  with self.assertRaises(ValueError):plan(x)
if __name__=='__main__':unittest.main()
