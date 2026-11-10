#!/usr/bin/env python3
"""Regression tests for guarded, sorted observed-flow insertion."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

P=Path(__file__).with_name('integrate-observed-flow.py')
spec=importlib.util.spec_from_file_location('observed_flow',P)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ObservedFlowTest(unittest.TestCase):
    def setUp(self):
        self.t=tempfile.TemporaryDirectory();self.addCleanup(self.t.cleanup)
        p=Path(self.t.name);self.port=p/'port';(self.port/'src').mkdir(parents=True)
        self.mini=p/'mini';self.mini.mkdir()
        aliases='static const Forja65AliasEntry kForja65Aliases[]={\n{0x001000u,0xC01000u},\n{0x001300u,0xC01300u},\n};'
        dispatch='static const Forja65DispatchEntry kForja65Dispatch[]={\n{0xC01000u,false,false,false,true,false,&old,0xC01000u},\n{0xC01300u,false,false,false,true,false,&old,0xC01300u},\n};'
        (self.port/'src/dispatch.cpp').write_text('void old();\nstruct Forja65AliasEntry{int off,pc;};\n'+aliases+'\nstruct dummy {};\n'+dispatch+'\n')
        (self.port/'CMakeLists.txt').write_text('add_library(forja65_generated OBJECT src/old.cpp)\n')
        self.newdispatch=self.mini/'dispatch.cpp';self.newshard=self.mini/'generated_004.cpp'
        self.newdispatch.write_text('void sub_C01200_E0M0X0C0(CpuState&, SnesRuntime&, std::uint32_t entryPc=0xC01200u);\n'+
            'static const Forja65AliasEntry kForja65Aliases[]={\n{0x001200u,0xC01200u},\n};\n'+
            'static const Forja65DispatchEntry kForja65Dispatch[]={\n{0xC01200u,false,false,false,true,false,&sub_C01200_E0M0X0C0,0xC01200u},\n};\n')
        self.newshard.write_text('void sub_C01200_E0M0X0C0(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) { if(entryPc) { return; } }\n')
    def test_sorted_monotonic_integration(self):
        result=m.merge(self.port,self.newdispatch,self.newshard,'C01200')
        self.assertEqual(result['new_entry_pcs'],1)
        data=(self.port/'src/dispatch.cpp').read_text()
        for snippet in ('0xC01000u','0xC01200u','0xC01300u'):self.assertIn(snippet,data)
        self.assertLess(data.index('{0xC01000u'),data.index('{0xC01200u'))
        self.assertLess(data.index('{0xC01200u'),data.index('{0xC01300u'))
        self.assertIn('src/forja_c01200.cpp',(self.port/'CMakeLists.txt').read_text())
        self.assertIn('void sub_C01200_E0M0X0C0',(self.port/'src/forja_c01200.cpp').read_text())
    def test_no_overlap(self):
        d=self.newdispatch.read_text().replace('0xC01200u','0xC01000u').replace('0x001200u','0x001000u')
        self.newdispatch.write_text(d)
        with self.assertRaisesRegex(ValueError,'already covers'):
            m.merge(self.port,self.newdispatch,self.newshard,'C01200')
        self.assertFalse((self.port/'src/forja_c01200.cpp').exists())
    def test_no_synthetic_routine(self):
        with self.assertRaisesRegex(ValueError,'absent'):
            m.merge(self.port,self.newdispatch,self.newshard,'C09999')
    def test_bad_address(self):
        with self.assertRaisesRegex(ValueError,'24-bit'):
            m.merge(self.port,self.newdispatch,self.newshard,'C0ZZZZ')

    def prepare_verified_overlap(self):
        import json
        original=(self.port/'src/dispatch.cpp').read_text()
        old_line='{0xC01203u,false,false,false,true,false,&sub_C01000_E0M0X0C0,0xC01000u},'
        original=original.replace('{0xC01300u,false', old_line+'\n{0xC01300u,false')
        (self.port/'src/dispatch.cpp').write_text(original)
        (self.port/'src/forja_c01000.cpp').write_text('void sub_C01000_E0M0X0C0(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) {\n// $C01203 LDA\n}\n')
        new_line='{0xC01203u,false,false,false,true,false,&sub_C01200_E0M0X0C0,0xC01200u},'
        orig=self.newdispatch.read_text()
        orig=orig.replace('{0xC01200u,false', new_line+'\n{0xC01200u,false')
        self.newdispatch.write_text(orig)
        self.newshard.write_text(self.newshard.read_text()+'// $C01203 LDA\n')
        proof={'schema':1,'rom':'2f095d162726b5ea','routine':'C01200','variants':1,
               'observed':[{'target':0xC01200,'from':0xC01100}],
               'decoded':[{'entryPc':0xC01200,'pcs':[0xC01200,0xC01203]}]}
        (self.mini/'proof.json').write_text(json.dumps(proof))

    def test_verified_overlap_preserves_existing_handler(self):
        self.prepare_verified_overlap()
        result=m.merge(self.port,self.newdispatch,self.newshard,'C01200',
                       expected_rom='2f095d162726b5ea',allow_verified_overlap=True)
        self.assertEqual(result['new_entry_pcs'],1)
        self.assertEqual(result['verified_existing_pcs'],1)
        contents=(self.port/'src/dispatch.cpp').read_text()
        self.assertEqual(contents.count('{0xC01203u'),1)
        self.assertIn('&sub_C01000_E0M0X0C0',contents)
        self.assertEqual(contents.count('{0xC01200u'),1)

    def test_verified_overlap_with_original_generated_shard(self):
        """Real ports keep initial handlers in generated_NNN.cpp, not forja_<PC>.cpp."""
        self.prepare_verified_overlap()
        (self.port/'src/forja_c01000.cpp').unlink()
        (self.port/'src/generated_009.cpp').write_text(
            'void sub_C01000_E0M0X0C0(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) {\n'
            '    // $C01203 LDA\n' 
            '}\n')
        result=m.merge(self.port,self.newdispatch,self.newshard,'C01200',
                       expected_rom='2f095d162726b5ea',allow_verified_overlap=True)
        self.assertEqual(result['verified_existing_pcs'], 1)
        self.assertIn('&sub_C01000_E0M0X0C0',(self.port/'src/dispatch.cpp').read_text())

    def test_verified_overlap_rejects_missing_generated_owner(self):
        self.prepare_verified_overlap()
        (self.port/'src/forja_c01000.cpp').unlink()
        with self.assertRaisesRegex(ValueError,'source definition'):
            m.merge(self.port,self.newdispatch,self.newshard,'C01200',
                    expected_rom='2f095d162726b5ea',allow_verified_overlap=True)

    def test_verified_overlap_rejects_instruction_mismatch(self):
        self.prepare_verified_overlap()
        unit=self.port/'src/forja_c01000.cpp'
        unit.write_text(unit.read_text().replace('LDA','ADC'))
        with self.assertRaisesRegex(ValueError,'opcode mismatch'):
            m.merge(self.port,self.newdispatch,self.newshard,'C01200',
                    expected_rom='2f095d162726b5ea',allow_verified_overlap=True)
        self.assertFalse((self.port/'src/forja_c01200.cpp').exists())

    def test_verified_overlap_rejects_missing_cpu_variant(self):
        self.prepare_verified_overlap()
        self.newdispatch.write_text(self.newdispatch.read_text().replace(
            '{0xC01203u,false,false,false,true,false,',
            '{0xC01203u,false,true,false,true,false,'))
        with self.assertRaisesRegex(ValueError,'missing compatible CPU state'):
            m.merge(self.port,self.newdispatch,self.newshard,'C01200',
                    expected_rom='2f095d162726b5ea',allow_verified_overlap=True)

    def test_rom_proof_rejects_wrong_observed_cpu_state(self):
        self.prepare_verified_overlap()
        proof_path = self.mini/'proof.json'
        proof = json.loads(proof_path.read_text())
        proof['observed'][0]['state'] = {'emulation':False,'m8':False,'x8':False,'carry':True}
        proof['decoded'][0]['entryState'] = {'emulation':False,'m8':False,'x8':False,'carry':False}
        proof_path.write_text(json.dumps(proof))
        with self.assertRaisesRegex(ValueError, 'observed CPU state'):
            m.merge(self.port,self.newdispatch,self.newshard,'C01200',
                    expected_rom='2f095d162726b5ea',allow_verified_overlap=True)
        self.assertFalse((self.port/'src/forja_c01200.cpp').exists())

    def test_verified_overlap_requires_rom_proof(self):
        self.prepare_verified_overlap()
        with self.assertRaisesRegex(ValueError,'requires ROM proof'):
            m.merge(self.port,self.newdispatch,self.newshard,'C01200',
                    allow_verified_overlap=True)
        with self.assertRaisesRegex(ValueError,'fingerprint'):
            m.merge(self.port,self.newdispatch,self.newshard,'C01200',
                    expected_rom='0000000000000000',allow_verified_overlap=True)

    def test_old_carry_unknown_covers_new_specific_state(self):
        self.prepare_verified_overlap()
        old_path=self.port/'src/dispatch.cpp'
        old_path.write_text(old_path.read_text().replace(
            '{0xC01203u,false,false,false,true,false,',
            '{0xC01203u,false,false,false,false,false,'))
        new_path=self.newdispatch
        new_path.write_text(new_path.read_text().replace(
            '{0xC01203u,false,false,false,true,false,',
            '{0xC01203u,false,false,false,true,true,'))
        result=m.merge(self.port,new_path,self.newshard,'C01200',
                       expected_rom='2f095d162726b5ea',allow_verified_overlap=True)
        self.assertEqual(result['verified_existing_pcs'],1)
        self.assertEqual((self.port/'src/dispatch.cpp').read_text().count('{0xC01203u'),1)

    def test_new_carry_unknown_requires_both_old_carry_branches(self):
        self.prepare_verified_overlap()
        new_path=self.newdispatch
        new_path.write_text(new_path.read_text().replace(
            '{0xC01203u,false,false,false,true,false,',
            '{0xC01203u,false,false,false,false,false,'))
        with self.assertRaisesRegex(ValueError,'missing compatible CPU state'):
            m.merge(self.port,new_path,self.newshard,'C01200',
                    expected_rom='2f095d162726b5ea',allow_verified_overlap=True)
        self.assertFalse((self.port/'src/forja_c01200.cpp').exists())

if __name__=='__main__':unittest.main()
