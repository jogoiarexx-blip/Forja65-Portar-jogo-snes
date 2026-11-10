#!/usr/bin/env python3
"""Fast negative tests: static JSR generation must reject spoofed proof before decoding."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

JS=Path(__file__).with_name('generate-observed-flow.js')
class RejectBogusProofs(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.addCleanup(self.t.cleanup)
  p=Path(self.t.name);self.dir=p;self.rom=p/'cart-data.bin';self.out=p/'out';self.site=p/'site.json'
  self.rom.write_bytes(bytes.fromhex('20 f9 92')+b'\0'*30)
  self.info={'schema':1,'kind':'STATIC_JSR_SITE','caller':'B6936B','target':'B692F9','rom_sha256':hashlib.sha256(self.rom.read_bytes()).hexdigest(),'physical_offset':0,'opcode':'20f992','mapper':'hirom','possible_entry_states':[{'e':0,'m':0,'x':0,'c':1}]}
 def reject(self,expect):
  self.site.write_text(json.dumps(self.info))
  r=subprocess.run(['node',str(JS),str(self.rom),str(self.site),'B692F9',str(self.out),'--static-jsr'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  self.assertNotEqual(r.returncode,0);self.assertIn(expect,r.stderr)
 def test_bad_hash(self):
  self.info['rom_sha256']='0'*64;self.reject('SHA256 mismatch')
 def test_bad_opcode(self):
  self.info['opcode']='ea00ee';self.reject('opcode/target')
 def test_missing_states(self):
  self.info['possible_entry_states']=[];self.reject('state candidates')
 def test_wrong_target(self):
  self.info['target']='B692F8';self.reject('target')
 def test_unexpected_option(self):
  self.site.write_text(json.dumps(self.info));r=subprocess.run(['node',str(JS),str(self.rom),str(self.site),'B692F9',str(self.out),'--unsafe'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  self.assertNotEqual(r.returncode,0);self.assertIn('Unknown option',r.stderr)
if __name__=='__main__':unittest.main()
