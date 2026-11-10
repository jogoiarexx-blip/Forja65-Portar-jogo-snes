"""Compile generated artifacts, so JS escaping cannot silently break new ports."""
import subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class GeneratedBuilderTests(unittest.TestCase):
 def test_generated_builder_and_vram_smoke_compile_and_run(self):
  with tempfile.TemporaryDirectory() as t:
   d=Path(t)
   script='''const fs=require('fs'),path=require('path'),F=require('./forja65-core');const r=F.loadRom(F.makeSyntheticRom());const files=F.generateProject(r,F.analyze(r,96));for(const [n,b] of Object.entries(files)){const p=path.join(process.argv[1],n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b instanceof Uint8Array?b:String(b));}'''
   subprocess.run(['node','-e',script,str(d)],cwd=ROOT,check=True,capture_output=True)
   for source,name in [('tools/rom_pack_builder.cpp','builder'),('tests/rom_ppu_r4_smoke.cpp','smoke')]:
    p=subprocess.run(['g++','-std=c++20','-O0','-I'+str(d/'src'),str(d/source),'-o',str(d/name)],capture_output=True,text=True)
    self.assertEqual(p.returncode,0,p.stderr[:3000])
   subprocess.run([str(d/'builder'),'assets/cart-data.bin','--full','assets/native-rom-data.bin'],cwd=d,check=True,capture_output=True)
   p=subprocess.run([str(d/'smoke')],cwd=d,capture_output=True,text=True)
   self.assertEqual(p.returncode,0,p.stdout+p.stderr)
if __name__=='__main__':unittest.main()
