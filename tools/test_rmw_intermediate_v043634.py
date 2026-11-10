"""Validate intermediate operand accesses by executing generated C++ runtime."""
import importlib.util
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
ORACLE=ROOT/'tools/rmw-reference-oracle-v043633.py'
spec=importlib.util.spec_from_file_location('rmw_oracle_34',ORACLE)
model=importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)

class IntermediateTests(unittest.TestCase):
    def test_generated_runtime_both_modes_8_instructions_and_io_guard(self):
        node=shutil.which('node')
        cpp=shutil.which('g++') or shutil.which('clang++')
        if not node or not cpp:self.skipTest('Node.js and C++ compiler required')
        with tempfile.TemporaryDirectory() as tmp:
            d=pathlib.Path(tmp)
            generate="""const fs=require('fs'),path=require('path'),api=require(process.argv[1]);
const rom=api.loadRom(api.makeSyntheticRom());
for(const [name,data] of Object.entries(api.generateProject(rom,api.analyze(rom,700)))){
 const file=path.join(process.argv[2],name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);
}"""
            p=subprocess.run([node,'-e',generate,str(ROOT/'forja65-core.js'),str(d)],capture_output=True,text=True,timeout=90)
            self.assertEqual(p.returncode,0,p.stderr[-2000:])
            exe=d/'test-rmw34'
            p=subprocess.run([cpp,'-std=c++20','-O0','-I',str(d/'src'),str(ROOT/'tests/rmw_wram_intermediate_v043634.cpp'),'-o',str(exe)],capture_output=True,text=True,timeout=90)
            self.assertEqual(p.returncode,0,p.stderr[-2000:])
            p=subprocess.run([str(exe)],cwd=d,capture_output=True,text=True,timeout=45)
            self.assertEqual(p.returncode,0,p.stdout[-2000:]+p.stderr[-2000:])
            self.assertIn('cases=32',p.stdout)
            latest8=[0x35,0x33,0x68,0x1a,0x68,0x1a,0xf4,0x04]
            latest16=[0x1235,0x1233,0x2468,0x091a,0x2468,0x091a,0x12f4,0x1204]
            for mode in ('emulation','native'):
                for bits,updates in ((8,latest8),(16,latest16)):
                    for j,opcode in enumerate(['INC','DEC','ASL','LSR','ROL','ROR','TSB','TRB']):
                        with self.subTest(mode=mode,bits=bits,opcode=opcode):
                            captured=d/f'rmw34-{mode}-{opcode}{bits}.csv'
                            records=model.load_operand_events(captured)
                            result=model.audit(records,0x7e0050,0x34 if bits==8 else 0x1234,updates[j],bits,mode,"scpu")
                            self.assertTrue(result['match'],result)
                            self.assertFalse(result['timing_checked'])
            self.assertEqual(model.load_operand_events(d/'rmw34-io-guard.csv'),[])

    def test_source_guard_and_all_eight_call_sites(self):
        core=(ROOT/'forja65-core.js').read_text()
        start=core.index('inline void CpuState::incMem(')
        end=core.index('// Extended 65C816 stack instructions',start)
        self.assertEqual(core[start:end].count('hw.rmwIntermediate(addr,'),8)
        self.assertIn('Instruction cycle accounting already includes this cycle',core)

if __name__=='__main__':unittest.main()
