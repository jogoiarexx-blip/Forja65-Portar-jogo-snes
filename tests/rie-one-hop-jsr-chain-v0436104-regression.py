#!/usr/bin/env python3
"""Proof-boundary and deterministic bounded-prefetch tests; no game required."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

MOD=Path(__file__).resolve().parents[1]/'tools/advance-rom-jsr-chain.py'
spec=importlib.util.spec_from_file_location('rie_chain',MOD)
chain=importlib.util.module_from_spec(spec)
spec.loader.exec_module(chain)

class Tests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.p=Path(self.temp.name);(self.p/'src').mkdir()
  (self.p/'src/dispatch.cpp').write_text('{0xBEE670u,false,false,false,false,false,&sub_BEE670_E0M0X0CQ,0xBEE670u},\n')
  self.src='// $BEE670 JSR -> $BEE682 stack real\n// $BEE675 JSR -> $BEE6F0 stack real\n// $BEE67B JSL -> $BB85A3 stack real\n'
  (self.p/'src/forja_bee670.cpp').write_text(self.src)
  self.rom=bytearray(0x400000)
  self.rom[0x3EE670:0x3EE673]=bytes.fromhex('20 82 e6')
  self.rom[0x3EE675:0x3EE678]=bytes.fromhex('20 f0 e6')
  self.rom[0x3EE67B:0x3EE67F]=bytes.fromhex('22 a3 85 bb')
  self.calls=[{'source':a,'target':b,'kind':c,'operand_hex':op,'proof':'ROM_LITERAL_CALL_NOT_EXECUTED'} for a,b,c,op in [
    ('BEE670','BEE682','JSR','20 82 E6'),('BEE675','BEE6F0','JSR','20 F0 E6'),('BEE67B','BB85A3','JSL','22 A3 85 BB')]]
  self.evidence=({'entry':'BEE670','rom':{'sha256':'x'}},{'candidates':self.calls},bytes(self.rom))
 def examine(self,max_new=4):
  with patch.object(chain,'ensure_root',return_value=self.evidence):
   return chain.plan(self.p,self.p/'generated',max_new)
 def test_finds_two_real_rom_jsrs_with_provenance(self):
  result=self.examine()
  self.assertEqual([c['target'] for c in result['eligible']],['BEE682','BEE6F0'])
  self.assertEqual(result['skipped'][0]['reason'],'JSL_requires_separate_state_proof')
  self.assertFalse(result['runtime_observed'])
 def test_bounded_queue(self):
  result=self.examine(1)
  self.assertEqual(len(result['eligible']),1)
  self.assertEqual(result['skipped'][0]['reason'],'bounded_budget')
 def test_preserves_existing_dispatch_owner(self):
  (self.p/'src/dispatch.cpp').write_text((self.p/'src/dispatch.cpp').read_text()+'{0xBEE682u,false,false,false,false,false,&sub_BEE682_E0M0X0CQ,0xBEE682u},\n')
  self.assertEqual([c['target'] for c in self.examine()['eligible']],['BEE6F0'])
 def test_rejects_rom_operand_mutation(self):
  self.rom[0x3EE671]=0x00
  self.evidence=self.evidence[:2]+(bytes(self.rom),)
  with self.assertRaisesRegex(ValueError,'ROM opcode/operand mismatch'):self.examine()
 def test_rejects_fake_generated_call(self):
  self.calls[0]['source']='BEE672'
  with self.assertRaisesRegex(ValueError,'not present in authenticated source'):self.examine()
 def test_bad_budget(self):
  with self.assertRaisesRegex(ValueError,'max-new'):self.examine(0)

if __name__=='__main__':unittest.main()
