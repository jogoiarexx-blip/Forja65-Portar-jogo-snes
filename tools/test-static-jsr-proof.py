import importlib.util
import tempfile
import unittest
from pathlib import Path
import hashlib
import copy
here=Path(__file__).parent
spec=importlib.util.spec_from_file_location('observed',here/'integrate-observed-flow.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class StrictStaticProofTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
  (self.root/'src').mkdir();(self.root/'assets').mkdir()
  rom=bytearray(0x400000);rom[0x36936b:0x36936e]=bytes.fromhex('20f992')
  (self.root/'assets/cart-data.bin').write_bytes(rom)
  self.digest=hashlib.sha256(rom).hexdigest()
  (self.root/'src/dispatch.cpp').write_text('{0xB6936Bu,false,false,false,false,false,&sub_B6933F_E0M0X0CQ,0xB6933Fu},\n')
  (self.root/'src/forja_b6933f.cpp').write_text('void sub_B6933F_E0M0X0CQ(CpuState& c, SnesRuntime& h, std::uint32_t p) {\n// $B6936B JSR -> $B692F9 stack real\ncpu.push16Value(hw,0x936Du);\n}\n')
  self.proof={'observed':[{'target':0xB692F9,'from':0xB6936B,'kind':'STATIC_JSR','state':{'emulation':False,'m8':False,'x8':False,'carry':False}}, {'target':0xB692F9,'from':0xB6936B,'kind':'STATIC_JSR','state':{'emulation':False,'m8':False,'x8':False,'carry':True}}], 'mapper':'hirom','static_site_rom_sha256':self.digest}
 def check(self):mod.verify_static_jsr_site(self.root,self.proof,'B692F9')
 def test_good(self):self.check()
 def test_wrong_hash(self):
  self.proof['static_site_rom_sha256']='0'*64
  with self.assertRaisesRegex(ValueError,'ROM source hash'):self.check()
 def test_missing_state(self):
  self.proof['observed'].pop()
  with self.assertRaisesRegex(ValueError,'candidate states'):self.check()
 def test_source_spoof(self):
  x=self.root/'src/forja_b6933f.cpp';x.write_text(x.read_text().replace('B692F9','B692F8'))
  with self.assertRaisesRegex(ValueError,'source-generated JSR'):self.check()
 def test_mixed_evidence(self):
  self.proof['observed'][1]['kind']='FLOW'
  with self.assertRaisesRegex(ValueError,'cannot mix'):self.check()

if __name__=='__main__':unittest.main()
