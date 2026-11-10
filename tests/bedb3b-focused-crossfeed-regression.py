#!/usr/bin/env python3
"""ROM-bound generated-function checks; no claim of runtime equivalence."""
import hashlib,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EV=ROOT/'reports/validation-crossfeed-0396/bedb3b-integrated'
class BEDB3B(unittest.TestCase):
 def test_provenance_and_integration(self):
  r=json.loads((EV/'integration-report.json').read_text())
  p=json.loads((EV/'bedb3b-rom-proof.json').read_text())
  self.assertEqual(p['entry'],r['entry'])
  self.assertEqual(r['entry'],'BEDB3B')
  self.assertEqual(p['rom_opcode_mismatches'],0)
  self.assertEqual(p['unique_rom_opcodes'],8)
  self.assertEqual(r['new_instruction_sites'],8)
  self.assertEqual(r['new_dispatch_rows'],24)
  self.assertEqual(r['address_overlap'],0)
  self.assertFalse(r['dry_run'])
  self.assertFalse(r['compile_and_replay_verified'])
  self.assertIn('runtime replay required',r['proof_level'])
  self.assertEqual(hashlib.sha256((EV/'forja_bedb3b.cpp').read_bytes()).hexdigest(),p['code_sha256'])
 def test_caller(self):
  j=json.loads((EV/'bedb3b-caller.json').read_text())
  self.assertEqual(j['entry'],'BED418')
  self.assertEqual(j['direct_target'],'BEDB3B')
  self.assertEqual(j['instruction_bytes'],'20 3B DB')
 def test_real_generated_entry(self):
  cpp=(EV/'forja_bedb3b.cpp').read_text()
  self.assertIn('void sub_BEDB3B_E0M0X0C0(',cpp)
  self.assertIn('void sub_BEDB3B_E0M0X0CQ(',cpp)
  self.assertEqual(len(re.findall(r'^L_BEDB[0-9A-F]{2}:',cpp,re.M)),16)
if __name__=='__main__':unittest.main()
