"""Generated runtime tests for read-to-clear IRQ/NMI status open-bus bits."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]

class StatusOpenBus37(unittest.TestCase):
    def test_generated_runtime_open_bus_masks(self):
        node=shutil.which('node')
        compiler=shutil.which('clang++') or shutil.which('g++')
        if not node or not compiler:self.skipTest('Node and C++ compiler needed')
        with tempfile.TemporaryDirectory() as tmp:
            dest=Path(tmp)
            generator='''const fs=require('fs'),path=require('path'),api=require(process.argv[1]);
const rom=api.loadRom(api.makeSyntheticRom());
for(const [name,data] of Object.entries(api.generateProject(rom,api.analyze(rom,700)))){
const file=path.join(process.argv[2],name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);
}'''
            p=subprocess.run([node,'-e',generator,str(ROOT/'forja65-core.js'),str(dest)],capture_output=True,text=True,timeout=90)
            self.assertEqual(p.returncode,0,p.stderr[-2500:])
            exe=dest/'test37'
            p=subprocess.run([compiler,'-std=c++20','-O0','-I',str(dest/'src'),str(ROOT/'tests/irq_open_bus_v043637.cpp'),'-o',str(exe)],capture_output=True,text=True,timeout=130)
            self.assertEqual(p.returncode,0,p.stderr[-2500:])
            p=subprocess.run([str(exe)],cwd=dest,capture_output=True,text=True,timeout=45)
            self.assertEqual(p.returncode,0,p.stdout[-2000:]+p.stderr[-2000:])
            self.assertIn('cases=4096',p.stdout)

    def test_source_masks(self):
        core=(ROOT/'forja65-core.js').read_text()
        for fragment in ['cpuDataBus&0x70u','cpuDataBus&0x7Fu','cpuDataBus&0x3Eu','io.nmiPending=false;return v;', 'io.irqPending=false;cpuIrqInterruptPending=false;']:
            self.assertIn(fragment,core)

if __name__=='__main__':unittest.main()
