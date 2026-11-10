#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path
p=Path(__file__).with_name('migrate_legacy_phk_pea_jmp.py')
spec=importlib.util.spec_from_file_location('legacy_phk',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MigrationTests(unittest.TestCase):
  def setUp(self):
    self.rom=bytearray(0x400000)
    pos=(0xB8&0x3f)*65536+0xA0C1
    self.rom[pos-4:pos+3]=bytes.fromhex('4B F4 C3 A0 DC B1 18')
    self.s='    hw.requestDispatch(hw.read24(0x18B1u),0xB8A0C1u); return;'
  def test_proven_site(self):
    new,pcs=m.migrate(self.s,self.rom,target_pc=0xB8A0C1)
    self.assertEqual(pcs,[0xB8A0C1]);self.assertIn('armConstructedLongReturn(0xB8A0C1u,cpu)',new)
  def test_idempotent(self):
    new,_=m.migrate(self.s,self.rom)
    twice,pcs=m.migrate(new,self.rom)
    self.assertEqual(pcs,[]);self.assertEqual(new,twice)
  def test_wrong_opcode(self):
    pos=(0xB8&0x3f)*65536+0xA0C1
    self.rom[pos-4]=0xEA
    self.assertEqual(m.migrate(self.s,self.rom)[1],[])
  def test_wrong_destination(self):
    self.assertEqual(m.migrate(self.s,self.rom,target_pc=0xB8A0C2)[1],[])
  def test_wrong_pointer_operand(self):
    source=self.s.replace('0x18B1','0x18B2')
    self.assertEqual(m.migrate(source,self.rom)[1],[])
if __name__=='__main__':unittest.main()
