"""End-to-end SNES RDNMI/TIMEUP read-to-clear RMW integration tests."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class RmwInterruptStatusTests(unittest.TestCase):
    def test_generated_runtime_modes_operations_mirrors_and_guards(self):
        node = shutil.which('node')
        compiler = shutil.which('clang++') or shutil.which('g++')
        if not node or not compiler:
            self.skipTest('Node.js and C++ compiler required')
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp)
            generator = '''const fs=require('fs'),path=require('path'),api=require(process.argv[1]);
const rom=api.loadRom(api.makeSyntheticRom());
for(const [name,data] of Object.entries(api.generateProject(rom,api.analyze(rom,700)))){
 const file=path.join(process.argv[2],name);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);
}'''
            p=subprocess.run([node,'-e',generator,str(ROOT/'forja65-core.js'),str(dest)],capture_output=True,text=True,timeout=90)
            self.assertEqual(p.returncode,0,p.stderr[-2000:])
            exe=dest/'rmw36-test'
            p=subprocess.run([compiler,'-std=c++20','-O0','-I',str(dest/'src'),str(ROOT/'tests/rmw_interrupt_status_v043636.cpp'),'-o',str(exe)],capture_output=True,text=True,timeout=130)
            self.assertEqual(p.returncode,0,p.stderr[-2000:])
            p=subprocess.run([str(exe)],cwd=dest,capture_output=True,text=True,timeout=55)
            self.assertEqual(p.returncode,0,p.stdout[-2000:]+p.stderr[-2000:])
            self.assertIn('cases=128',p.stdout)
            self.assertIn('guards=10',p.stdout)

    def test_source_guard(self):
        core=(ROOT/'forja65-core.js').read_text()
        self.assertIn('bool rmwSafeInterruptStatus(std::uint32_t addr,int w)const',core)
        self.assertIn('w==8 && ioBank(addr) && (reg==0x4210u || reg==0x4211u)',core)
        self.assertIn('Instruction cycle accounting already includes this cycle',core)
        self.assertIn('io.nmiPending=false;return v;',core)
        self.assertIn('io.irqPending=false;cpuIrqInterruptPending=false;',core)

if __name__=='__main__':
    unittest.main()
