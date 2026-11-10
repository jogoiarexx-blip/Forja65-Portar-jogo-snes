"""End-to-end test for RMW $2180 intermediate accesses in generated C++ runtime."""
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class RmwWramPortTests(unittest.TestCase):
    def test_generated_cpp_port_and_side_effects(self):
        node = shutil.which('node')
        compiler = shutil.which('g++') or shutil.which('clang++')
        if not node or not compiler:
            self.skipTest('Node and C++ compiler required')
        with tempfile.TemporaryDirectory() as tmp:
            dest=pathlib.Path(tmp)
            js = """const fs=require('fs'),path=require('path'),api=require(process.argv[1]);
const rom=api.loadRom(api.makeSyntheticRom());
for(const [name,data] of Object.entries(api.generateProject(rom,api.analyze(rom,700)))){
  const file=path.join(process.argv[2],name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);
}"""
            result=subprocess.run([node,'-e',js,str(ROOT/'forja65-core.js'),str(dest)],capture_output=True,text=True,timeout=100)
            self.assertEqual(result.returncode,0,result.stderr[-2000:])
            exe=dest/'rmw35-test'
            result=subprocess.run([compiler,'-std=c++20','-O0','-I',str(dest/'src'),str(ROOT/'tests/rmw_wram_port_v043635.cpp'),'-o',str(exe)],capture_output=True,text=True,timeout=120)
            self.assertEqual(result.returncode,0,result.stderr[-2000:])
            result=subprocess.run([str(exe)],cwd=dest,capture_output=True,text=True,timeout=45)
            self.assertEqual(result.returncode,0,result.stdout[-2000:]+result.stderr[-2000:])
            self.assertIn('cases=64',result.stdout)

    def test_source_guards(self):
        text=(ROOT/'forja65-core.js').read_text()
        self.assertIn('bool rmwSafeWramPort(std::uint32_t addr,int w)const',text)
        self.assertIn('return w==8 && ioBank(addr) && (addr&0xFFFFu)==0x2180u;',text)
        self.assertIn('Instruction cycle accounting already includes this cycle',text)

if __name__=='__main__':unittest.main()
