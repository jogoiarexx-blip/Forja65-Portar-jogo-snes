"""Fallback opcode fetch must work when ROM is stored only in the native pack."""
import subprocess,tempfile,unittest,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from rom_pack_gate_rev157 import make_pack
class NativeFetchTests(unittest.TestCase):
 def test_real_generated_peek_uses_pack_without_cart(self):
  with tempfile.TemporaryDirectory() as t:
   d=Path(t)
   script='''const fs=require('fs'),path=require('path'),F=require('./forja65-core');const r=F.loadRom(F.makeSyntheticRom());const files=F.generateProject(r,F.analyze(r,96));for(const [n,b]of Object.entries(files)){const p=path.join(process.argv[1],n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b instanceof Uint8Array?b:String(b));}fs.writeFileSync(path.join(process.argv[1],'interpreter.cpp'),F.buildCpuInterpreterSource());'''
   subprocess.run(['node','-e',script,str(d)],cwd=ROOT,check=True,capture_output=True)
   code=(d/'interpreter.cpp').read_text();start=code.index('static bool forja65_peek_code(');end=code.index('  struct ForjaInterpStats',start)
   rom=(d/'assets/cart-data.bin').read_bytes();(d/'assets/native-rom-data.bin').write_bytes(make_pack(rom))
   (d/'test.cpp').write_text('#include "runtime.hpp"\n'+code[start:end]+'''\nint main(){setenv("FORJA65_ROM_MODE","native",1);SnesRuntime hw("assets/cart-data.bin",MapperKind::LoROM,0,5,0,CartChip::None,"s.srm",1,true);std::uint8_t out[4]{};if(!hw.cart.empty())return 1;if(!forja65_peek_code(hw,0x008000,out))return 2;if(out[0]!=0x78||out[1]!=0x9c)return 3;return 0;}''')
   r=subprocess.run(['g++','-std=c++20','-O0','-I'+str(d/'src'),str(d/'test.cpp'),'-o',str(d/'test')],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr[:1000])
   r=subprocess.run([str(d/'test')],cwd=d,capture_output=True,text=True);self.assertEqual(r.returncode,0,'native pack opcode fetch failed: '+r.stdout+r.stderr)
if __name__=='__main__':unittest.main()
