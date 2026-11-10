"""Native C++ bus-clock trace and generator/template integration checks."""
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class BusClockTraceTests(unittest.TestCase):
    def test_cpp_recorder(self):
        compiler = shutil.which('g++') or shutil.which('clang++')
        if not compiler:
            self.skipTest('C++ compiler unavailable')
        with tempfile.TemporaryDirectory() as tmp:
            exe = pathlib.Path(tmp) / 'bus-clock-test'
            cmd = [compiler, '-std=c++17', '-Wall', '-Wextra', '-Werror',
                   '-I', str(ROOT / 'native'), str(ROOT / 'tests' / 'bus_clock_trace_v043631.cpp'),
                   '-o', str(exe)]
            build = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(build.returncode, 0, build.stderr)
            run = subprocess.run([str(exe), str(pathlib.Path(tmp) / 'capture.csv')],
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertIn('FORJA65_BUS_CLOCK_TRACE_PASS',run.stdout)

    def test_generator_uses_actual_scheduler_clock(self):
        code = (ROOT / 'forja65-core.js').read_text()
        self.assertIn('busClockTrace.emit(cpuMasterClock,frameCounter,lastInstructionPc,kind,traceSource,address,value,dummy)', code)
        self.assertIn('busClockTrace.initialize();', code)
        self.assertIn('ForjaBusClockTrace busClockTrace;', code)
        self.assertIn('cpuMasterClock+=step;', code)

    def test_embedded_header_is_exact_source(self):
        import re
        header = (ROOT / 'native' / 'forja_trace.hpp').read_text()
        source = (ROOT / 'native' / 'templates.js').read_text()
        embedded = re.search(r'"src/forja_trace.hpp":("(?:\\.|[^"\\])*")',source)
        self.assertIsNotNone(embedded)
        self.assertEqual(json.loads(embedded.group(1)),header)

    def test_embedded_core_header_is_exact_source(self):
        import re
        header = (ROOT / 'native' / 'forja_trace.hpp').read_text()
        source = (ROOT / 'forja65-core.js').read_text()
        embedded = re.search(r'"src/forja_trace.hpp":("(?:\\.|[^"\\])*")', source)
        self.assertIsNotNone(embedded)
        self.assertEqual(json.loads(embedded.group(1)), header)

    def test_generated_runtime_integration(self):
        compiler = shutil.which('g++') or shutil.which('clang++')
        node = shutil.which('node')
        if not compiler or not node:
            self.skipTest('Node.js/C++ compiler unavailable')
        with tempfile.TemporaryDirectory() as tmp:
            generated=pathlib.Path(tmp)
            js = """const fs=require('fs'),path=require('path'),api=require(process.argv[1]);
const rom=api.loadRom(api.makeSyntheticRom());
const files=api.generateProject(rom,api.analyze(rom,700));
for(const [name,data] of Object.entries(files)){
 const full=path.join(process.argv[2],name);
 fs.mkdirSync(path.dirname(full),{recursive:true});
 fs.writeFileSync(full,data);
}"""
            step=subprocess.run([node,'-e',js,str(ROOT/'forja65-core.js'),str(generated)],
                                capture_output=True,text=True)
            self.assertEqual(step.returncode,0,step.stderr)
            exe=generated/'integrated'
            build=subprocess.run([compiler,'-std=c++20','-O0','-I',str(generated/'src'),
                                  str(ROOT/'tests'/'bus_clock_runtime_generated_v043631.cpp'),
                                  '-o',str(exe)],capture_output=True,text=True)
            self.assertEqual(build.returncode,0,build.stderr)
            run=subprocess.run([str(exe)],cwd=generated,capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)

    def test_timestamp_and_dummy_are_not_fabricated(self):
        header = (ROOT / 'native' / 'forja_trace.hpp').read_text()
        self.assertIn('bus_microcycle_accurate=false',header)
        self.assertIn('dummy_classification=explicit_rmw_only',header)
        self.assertIn('<< dummy <<',header)

if __name__ == '__main__':
    unittest.main()
