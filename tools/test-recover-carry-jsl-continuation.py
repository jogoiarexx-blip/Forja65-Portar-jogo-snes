#!/usr/bin/env python3
"""Safety checks for reusing a carry-neutral post-JSL continuation."""
import importlib.util, tempfile, unittest
from pathlib import Path
loc=Path(__file__).with_name('recover-carry-jsl-continuation.py')
spec=importlib.util.spec_from_file_location('carryjsl',loc)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
ENTRY=0xB68140

class CarryJslRecovery(unittest.TestCase):
 def setUp(self):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);self.p=Path(t.name)
  (self.p/'src').mkdir();(self.p/'assets').mkdir();self.h=self.p/'runtime-hint.txt'
  r=bytearray(0x370000);r[0x368140:0x368144]=bytes.fromhex('22 06 a0 b9');(self.p/'assets/cart-data.bin').write_bytes(r)
  self.h.write_text('rom='+mod.rom_fingerprint(bytes(r))+' target=b68140 from=b68140 kind=STATE e=0 m=0 x=0 c=1\n')
  self.dispatch=self.p/'src/dispatch.cpp';self.dispatch.write_text('''static const Forja65DispatchEntry kForja65Dispatch[]={
{0xB68140u,false,false,false,true,false,&sub_B6813C_E0M0X0C0,0xB6813Cu},
};
''')
  self.unit=self.p/'src/generated_025.cpp';self.unit.write_text('''void sub_B6813C_E0M0X0C0(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) {
L_B68140:
  if(hw.stopped)return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false && cpu.c==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x8140u,0xB68140u); return; }
  hw.traceInstruction(0xB68140u,cpu,0x22u);
  // $B68140 JSL -> $B9A006 stack real
  { forja65_dispatch(cpu, hw, 0xB9A006u, 0xB68140u); }
  goto L_B68144;
L_B68144:
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch(0xB68144u,0xB68144u);return; }
  hw.traceInstruction(0xB68144u,cpu,0x4Cu);
}
''')
 def test_commit_preserves_original_dispatch(self):
  old=self.dispatch.read_text();o=mod.recover(self.p,ENTRY,hint=self.h,commit=True)
  self.assertEqual(o['added'],1)
  self.assertIn(old.splitlines()[1],self.dispatch.read_text())
  self.assertIn('true,true,&sub_B6813C',self.dispatch.read_text())
  self.assertNotIn('cpu.x8==false && cpu.c==false',self.unit.read_text())
 def test_dry_run_no_changes(self):
  d=self.dispatch.read_text();s=self.unit.read_text()
  mod.recover(self.p,ENTRY,hint=self.h)
  self.assertEqual(d,self.dispatch.read_text());self.assertEqual(s,self.unit.read_text())
 def test_bad_observation_rejected(self):
  self.h.write_text(self.h.read_text().replace('c=1','c=0'))
  with self.assertRaisesRegex(ValueError,'observed'):mod.recover(self.p,ENTRY,hint=self.h)
 def test_mismatch_rom_rejected(self):
  r=bytearray((self.p/'assets/cart-data.bin').read_bytes());r[0x368141]=0x07;(self.p/'assets/cart-data.bin').write_bytes(r)
  with self.assertRaisesRegex(ValueError,'fingerprint'):mod.recover(self.p,ENTRY,hint=self.h)
 def test_forged_rom_hash_rejected(self):
  self.h.write_text(self.h.read_text().replace(self.h.read_text()[4:20],'0000000000000000'))
  with self.assertRaisesRegex(ValueError,'fingerprint'):mod.recover(self.p,ENTRY,hint=self.h,commit=True)
 def test_carry_branch_rejected(self):
  self.unit.write_text(self.unit.read_text().replace('goto L_B68144;', 'if(cpu.c) return; goto L_B68144;'))
  with self.assertRaisesRegex(ValueError,'carry-inspecting'):mod.recover(self.p,ENTRY,hint=self.h)
 def test_repeat_rejected(self):
  mod.recover(self.p,ENTRY,hint=self.h,commit=True)
  with self.assertRaises(ValueError):mod.recover(self.p,ENTRY,hint=self.h,commit=True)
 def test_wrong_guard_rejected(self):
  self.unit.write_text(self.unit.read_text().replace('cpu.c==false','cpu.c==true'))
  with self.assertRaisesRegex(ValueError,'entry guard'):mod.recover(self.p,ENTRY,hint=self.h)

if __name__=='__main__': unittest.main()
