"""Integration and safety tests for explicit non-dummy RMW bus events."""
import json
import pathlib
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class RmwTraceTests(unittest.TestCase):
    def test_generated_cpp_runtime_rmw_read_write_order(self):
        compiler = shutil.which('g++') or shutil.which('clang++')
        node = shutil.which('node')
        if not compiler or not node:
            self.skipTest('Node.js and C++ compiler are required')
        with tempfile.TemporaryDirectory() as d:
            dest = pathlib.Path(d)
            code = """const fs=require('fs'),path=require('path'),api=require(process.argv[1]);
const rom=api.loadRom(api.makeSyntheticRom());
const generated=api.generateProject(rom,api.analyze(rom,700));
for(const [name,contents] of Object.entries(generated)){
 const file=path.join(process.argv[2],name);fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,contents);
}"""
            proc=subprocess.run([node,'-e',code,str(ROOT/'forja65-core.js'),str(dest)],capture_output=True,text=True,timeout=60)
            self.assertEqual(proc.returncode,0,proc.stderr)
            binary=dest/'rmw-integration'
            proc=subprocess.run([compiler,'-std=c++20','-O0','-I',str(dest/'src'),
                                 str(ROOT/'tests'/'rmw_trace_generated_v043632.cpp'),'-o',str(binary)],
                                 capture_output=True,text=True,timeout=60)
            self.assertEqual(proc.returncode,0,proc.stderr)
            proc=subprocess.run([str(binary)],cwd=dest,capture_output=True,text=True,timeout=20)
            self.assertEqual(proc.returncode,0,proc.stderr)
            self.assertIn('FORJA65_RMW_TRACE_PASS',proc.stdout)
            csv=(dest/'rmw-ASL16.csv').read_text()
            self.assertIn('bus_microcycle_accurate=false',csv)
            self.assertIn('dummy_classification=explicit_rmw_only',csv)
            self.assertIn(',read,CPU,8257616,52,false',csv)
            self.assertIn(',write,CPU,8257617,36,false',csv)

    def test_eight_rmw_implementations_use_explicit_reads(self):
        core=(ROOT/'forja65-core.js').read_text()
        start=core.index('inline void CpuState::incMem(')
        end=core.index('\n',core.index('inline void CpuState::trb(',start))
        methods=core[start:end]
        self.assertEqual(methods.count('hw.readRmw(addr,w)'),8)
        self.assertNotIn('hw.readW(addr,w)',methods)
        self.assertIn('"false"',core[core.index('void writeRmw('):core.index('void traceInstruction(')])

    def test_header_fidelity_both_embeddings(self):
        header=(ROOT/'native/forja_trace.hpp').read_text()
        pat=r'"src/forja_trace.hpp":("(?:\\.|[^"\\])*")'
        for file in ['forja65-core.js','native/templates.js']:
            match=re.search(pat,(ROOT/file).read_text())
            self.assertIsNotNone(match,file)
            self.assertEqual(json.loads(match.group(1)),header)

    def test_trace_default_is_not_falsely_classified(self):
        code=(ROOT/'forja65-core.js').read_text()
        self.assertIn('const char*dummy="unknown"',code)
        self.assertIn('read(a,"false")',code)
        self.assertIn('observeBus("write",a,v,dummy)',code)
        self.assertIn('bus_microcycle_accurate=false',(ROOT/'native/forja_trace.hpp').read_text())


if __name__=='__main__':
    unittest.main()
