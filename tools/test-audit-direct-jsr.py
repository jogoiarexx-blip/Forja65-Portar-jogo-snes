import importlib.util
import tempfile
import unittest
from pathlib import Path
s=importlib.util.spec_from_file_location('jsr',Path(__file__).with_name('audit-direct-jsr.py'))
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class DirectJsrAuditTest(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.addCleanup(self.t.cleanup);self.p=Path(self.t.name)
  (self.p/'src').mkdir();(self.p/'assets').mkdir()
  b=bytearray(0x400000);b[0x36936b:0x36936e]=bytes.fromhex('20 f9 92')
  (self.p/'assets/cart-data.bin').write_bytes(b)
  (self.p/'src/dispatch.cpp').write_text('''{0xB6936Bu,false,false,false,false,false,&sub_B6933F_E0M0X0CQ,0xB6933Fu},\n{0xB6936Bu,false,false,false,true,true,&sub_B6933F_E0M0X0CQ,0xB6933Fu},\n''')
  (self.p/'src/forja_b6933f.cpp').write_text('''void sub_B6933F_E0M0X0CQ(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) {\n// $B6936B JSR -> $B692F9 stack real\ncpu.push16Value(hw,0x936Du);\n}\n''')
 def test_verified(self):
  r=m.audit(self.p,0xB6936B,0xB692F9)
  self.assertEqual(len(r['possible_entry_states']),2)
  self.assertEqual(r['runtime_state_measured'],False)
  self.assertEqual(r['physical_offset'],0x36936b)
 def test_wrong_target(self):
  with self.assertRaisesRegex(ValueError,'points to'):m.audit(self.p,0xB6936B,0xB692FA)
 def test_wrong_opcode(self):
  b=bytearray((self.p/'assets/cart-data.bin').read_bytes());b[0x36936b]=0xEA;(self.p/'assets/cart-data.bin').write_bytes(b)
  with self.assertRaisesRegex(ValueError,'not an absolute JSR'):m.audit(self.p,0xB6936B,0xB692F9)
 def test_existing_target(self):
  with (self.p/'src/dispatch.cpp').open('a') as f:f.write('{0xB692F9u,false,false,false,true,false,&sub_B6933F_E0M0X0CQ,0xB6933Fu},\n')
  with self.assertRaisesRegex(ValueError,'already has dispatcher'):m.audit(self.p,0xB6936B,0xB692F9)
 def test_bad_return_address(self):
  p=self.p/'src/forja_b6933f.cpp';p.write_text(p.read_text().replace('0x936Du','0x936Cu'))
  with self.assertRaisesRegex(ValueError,'return address'):m.audit(self.p,0xB6936B,0xB692F9)
 def test_bad_source_edge(self):
  p=self.p/'src/forja_b6933f.cpp';p.write_text(p.read_text().replace('B692F9','B692F8'))
  with self.assertRaisesRegex(ValueError,'source-generated JSR'):m.audit(self.p,0xB6936B,0xB692F9)
if __name__=='__main__':unittest.main()
