"""Checks for RMW reference model, diagnostics and safety constraints."""
import importlib.util
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
TOOL=ROOT/'tools'/'rmw-reference-oracle-v043633.py'
spec=importlib.util.spec_from_file_location('rmw_oracle',TOOL)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class OracleTests(unittest.TestCase):
    def test_all_width_and_mode_expected_sequences(self):
        for bits in (8,16):
            for mode in ('native','emulation'):
                with self.subTest(bits=bits,mode=mode):
                    e=m.expected_events(0x7e0050,0x1234 if bits==16 else 0x34,0x5678 if bits==16 else 0x78,bits,mode)
                    self.assertEqual(len(e),3 if bits==8 else 5)
                    self.assertEqual(e[-1]['address'],0x7e0050)
                    self.assertEqual(e[-1]['kind'],'write')
                    self.assertEqual(e[-2]['address'],0x7e0051 if bits==16 else 0x7e0050)
                    intermediate=e[bits//8]
                    self.assertEqual(intermediate['kind'],'read' if mode=='native' else 'write')
                    self.assertTrue(intermediate['dummy'])
                    self.assertTrue(m.audit(e,0x7e0050,0x1234 if bits==16 else 0x34,0x5678 if bits==16 else 0x78,bits,mode)['match'])

    def test_missing_intermediate_read_or_old_write_is_reported(self):
        for bits,mode in [(8,'native'),(8,'emulation'),(16,'native'),(16,'emulation')]:
            with self.subTest(bits=bits,mode=mode):
                o,n=(0x1234,0x5678) if bits==16 else (0x34,0x78)
                expected=m.expected_events(0x7e0050,o,n,bits,mode)
                candidate=expected[:bits//8]+expected[bits//8+1:]
                result=m.audit(candidate,0x7e0050,o,n,bits,mode)
                self.assertFalse(result['match'])
                self.assertEqual(len(result['missing_events']),1)
                self.assertEqual(result['missing_events'][0]['kind'],'read' if mode=='native' else 'write')
                self.assertFalse(result['timing_checked'])

    def test_high_byte_wraps_inside_same_bank(self):
        e=m.expected_events(0x7effff,0x1234,0x5678,16,'native')
        self.assertEqual(e[1]['address'],0x7e0000)
        self.assertEqual(e[-2]['address'],0x7e0000)

    def test_inconsistent_extra_and_dummy_flag(self):
        e=m.expected_events(0x7e0050,0x34,0x78,8,'native')
        changed=[dict(x) for x in e]
        changed[1]['dummy']='false'
        self.assertEqual(len(m.audit(changed,0x7e0050,0x34,0x78,8,'native')['classification_mismatches']),1)
        changed=[dict(x) for x in e]+[{'kind':'read','address':0,'value':0,'dummy':'unknown'}]
        self.assertEqual(len(m.audit(changed,0x7e0050,0x34,0x78,8,'native')['unexpected_events']),1)

    def test_reject_truncated_capture_and_allow_unknown_dummy(self):
        data='# FORJA_BUS_CLOCK_TRACE 1 timing_basis=runtime_scheduler_clock\nseq,master_cycle,frame,pc,kind,source,address,value,dummy\n0,1,0,8388608,read,CPU,8257616,52,unknown\n'
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'captured.csv'
            p.write_text(data+'# written=1 dropped=1\n')
            with self.assertRaisesRegex(ValueError,'dropped'):m.load_operand_events(p)
            p.write_text(data+'# written=1 dropped=0\n')
            self.assertEqual(len(m.load_operand_events(p)),1)
            self.assertEqual(len(m.load_operand_events(p,pc=1)),0)

    def test_invalid_input_rejected(self):
        for parameters in [(0x7e0050,0,0,24,'native'),(0x7e0050,0,0,8,'other'),(0x1000000,0,0,8,'native')]:
            with self.assertRaises(ValueError):m.expected_events(*parameters)

    def test_runtime_cpp_generated_reports_missing_intermediate_access(self):
        compiler=shutil.which('g++') or shutil.which('clang++')
        node=shutil.which('node')
        if not compiler or not node:self.skipTest('Requires g++ and node')
        with tempfile.TemporaryDirectory() as d:
            dest=pathlib.Path(d)
            code="""const fs=require('fs'),path=require('path'),api=require(process.argv[1]);
const rom=api.loadRom(api.makeSyntheticRom());
const generated=api.generateProject(rom,api.analyze(rom,700));
for(const [name,contents] of Object.entries(generated)){
 const file=path.join(process.argv[2],name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,contents);
}"""
            proc=subprocess.run([node,'-e',code,str(ROOT/'forja65-core.js'),str(dest)],capture_output=True,text=True,timeout=90)
            self.assertEqual(proc.returncode,0,proc.stderr[-1000:])
            exe=dest/'rmw-integration'
            proc=subprocess.run([compiler,'-std=c++20','-O0','-I',str(dest/'src'),str(ROOT/'tests'/'rmw_trace_generated_v043632.cpp'),'-o',str(exe)],capture_output=True,text=True,timeout=90)
            self.assertEqual(proc.returncode,0,proc.stderr[-1000:])
            proc=subprocess.run([str(exe)],cwd=dest,capture_output=True,text=True,timeout=45)
            self.assertEqual(proc.returncode,0,proc.stderr[-1000:])
            self.assertIn('FORJA65_RMW_TRACE_PASS',proc.stdout)
            new8=[0x35,0x33,0x68,0x1a,0x68,0x1a,0xf4,0x04]
            new16=[0x1235,0x1233,0x2468,0x091a,0x2468,0x091a,0x12f4,0x1204]
            for bits in (8,16):
                for idx,name in enumerate(['INC','DEC','ASL','LSR','ROL','ROR','TSB','TRB']):
                    with self.subTest(bits=bits,opcode=name):
                        path=dest/f'rmw-{name}{bits}.csv'
                        events=m.load_operand_events(path)
                        old=0x34 if bits==8 else 0x1234
                        new=(new8 if bits==8 else new16)[idx]
                        # Legacy generated C++ fixture uses the CpuState default
                        # e=true, and must now match emulation-mode oracle on WRAM.
                        report=m.audit(events,0x7e0050,old,new,bits,'emulation','scpu')
                        self.assertTrue(report['match'],report)
                        # The CLK internal-cycle model must still detect the omitted internal pin event.
                        report=m.audit(events,0x7e0050,old,new,bits,'native')
                        self.assertFalse(report['match'])
            # CLI now reports success for the corrected emulation-mode trace.
            cmd=[sys.executable,str(TOOL),str(dest/'rmw-INC8.csv'),'--opcode','INC','--bits','8',
                 '--mode','emulation','--bus-model','scpu','--address','0x7e0050','--old','0x34','--new','0x35',
                 '--output',str(dest/'oracle.json')]
            proc=subprocess.run(cmd,capture_output=True,text=True,timeout=15)
            self.assertEqual(proc.returncode,0,proc.stderr)
            self.assertTrue(__import__('json').loads((dest/'oracle.json').read_text())['match'])

if __name__=='__main__':unittest.main()
