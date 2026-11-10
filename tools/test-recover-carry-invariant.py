#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('recover',Path(__file__).with_name('recover-carry-invariant.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
SITES=[(0x808337,'SEP',0xE2,'false'),(0x808339,'LDA',0xAF,'true'),(0x80833D,'STA',0x8F,'true'),(0x808341,'REP',0xC2,'true'),(0x808343,'RTL',0x6B,'false')]

class CarryGuardTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.port=Path(self.temp.name);(self.port/'assets').mkdir();(self.port/'src').mkdir()
  rom=bytearray(0x10000)
  for pc,_,op,_ in SITES:rom[pc&0x3fffff]=op
  rom[0x8338]=0x20;rom[0x8342]=0x20
  self.rom=self.port/'assets/cart-data.bin';self.rom.write_bytes(rom)
  self.dispatch=self.port/'src/dispatch.cpp'
  self.dispatch.write_text('''static const Forja65DispatchEntry kForja65Dispatch[]={\n'''+ '\n'.join(f'{{0x{pc:06X}u,false,{flag},false,true,true,&sub_808337_E0M0X0C1,0x808337u}},' for pc,_,_,flag in SITES)+'''\n};\n''')
  self.cpp=self.port/'src/generated_052.cpp'
  self.cpp.write_text('void sub_808337_E0M0X0C1(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) {\n'+ '\n'.join(f'// ${pc:06X} {name}\n' for pc,name,_,_ in SITES)+'}\n')
 def test_real_allowed_copy(self):
  before=self.dispatch.read_text();p=m.recover(self.port,0x808337,commit=True)
  self.assertEqual(p['new_dispatch_rows'],5)
  self.assertEqual(p['after_dispatch_rows'],10)
  self.assertIn(before.splitlines()[1],self.dispatch.read_text())
 def test_wrong_mask(self):
  rom=bytearray(self.rom.read_bytes());rom[0x8338]=0x21;self.rom.write_bytes(rom)
  with self.assertRaisesRegex(ValueError,'modifies carry'):m.recover(self.port,0x808337)
 def test_branch_rejected(self):
  rom=bytearray(self.rom.read_bytes());rom[0x8339]=0x90;self.rom.write_bytes(rom)
  with self.assertRaisesRegex(ValueError,'carry-sensitive'):m.recover(self.port,0x808337)
 def test_codegen_carry_read(self):
  self.cpp.write_text(self.cpp.read_text().replace('// $808343 RTL','if(cpu.c) return;\n// $808343 RTL'))
  with self.assertRaisesRegex(ValueError,'inspects/modifies carry'):m.recover(self.port,0x808337)
 def test_repeat_rejected(self):
  m.recover(self.port,0x808337,commit=True)
  with self.assertRaises(ValueError):m.recover(self.port,0x808337,commit=True)
 def test_partial_source_rejected(self):
  self.cpp.write_text(self.cpp.read_text().replace('// $808341 REP','// $808341 NOP'))
  with self.assertRaisesRegex(ValueError,'source mismatch'):m.recover(self.port,0x808337)

if __name__=='__main__':unittest.main()
