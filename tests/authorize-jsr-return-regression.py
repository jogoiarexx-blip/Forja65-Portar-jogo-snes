#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'tools' / 'authorize-jsr-return.py'
spec = importlib.util.spec_from_file_location('authorize_jsr_return',SCRIPT)
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

class DirectJSRReturnTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.p=Path(self.temp.name)
        (self.p/'src').mkdir()
        (self.p/'assets').mkdir()
        rom=bytearray(0x10000)
        rom[0x9000:0x9003]=b'\x20\xcf\xc7'
        self.rom=self.p/'test.sfc';self.rom.write_bytes(rom)
        (self.p/'assets/cart-data.bin').write_bytes(rom)
        (self.p/'src/forja.cpp').write_text('// $C09000 JSR -> $C0C7CF stack real\n')
        (self.p/'src/dispatch.cpp').write_text('static const Forja65AliasEntry kForja65Aliases[]={\n{0x001000u,0xC01000u},\n{0x00A000u,0xC0A000u},\n};\nstatic const std::uint32_t kForja65StackReturnOffsets[]={0x001000u,0x00A000u};\n{0xC09003u,false,false,false,false,false,&sub,0xC00000u},\n')

    def test_exact_return(self):
        r=m.authorize(self.p,self.rom,'C09000','C09003',apply=True)
        self.assertTrue(r['applied'])
        self.assertEqual(r['jsr_target'],'C7CF')
        self.assertIn('0x009003u', (self.p/'src/dispatch.cpp').read_text())
        self.assertIn('{0x009003u,0xC09003u}', (self.p/'src/dispatch.cpp').read_text())
        self.assertTrue(m.authorize(self.p,self.rom,'C09000','C09003',apply=True)['already_authorized'])

    def test_dry_run_is_non_mutating(self):
        old=(self.p/'src/dispatch.cpp').read_bytes()
        self.assertFalse(m.authorize(self.p,self.rom,'C09000','C09003')['applied'])
        self.assertEqual((self.p/'src/dispatch.cpp').read_bytes(),old)

    def test_wrong_return(self):
        with self.assertRaisesRegex(ValueError,'length'):
            m.authorize(self.p,self.rom,'C09000','C09005',apply=True)

    def test_rom_mismatch(self):
        (self.p/'assets/cart-data.bin').write_bytes(b'not a rom')
        with self.assertRaisesRegex(ValueError,'match'):
            m.authorize(self.p,self.rom,'C09000','C09003')

    def test_not_a_jsr(self):
        data=bytearray(self.rom.read_bytes());data[0x9000]=0xEA
        self.rom.write_bytes(data);(self.p/'assets/cart-data.bin').write_bytes(data)
        with self.assertRaisesRegex(ValueError,'JSR'):
            m.authorize(self.p,self.rom,'C09000','C09003')

    def test_untranslated_call(self):
        (self.p/'src/forja.cpp').write_text('empty')
        with self.assertRaisesRegex(ValueError,'not translated'):
            m.authorize(self.p,self.rom,'C09000','C09003')

    def test_untranslated_return(self):
        (self.p/'src/dispatch.cpp').write_text('static const std::uint32_t kForja65StackReturnOffsets[]={0x001000u};')
        with self.assertRaisesRegex(ValueError,'dispatcher'):
            m.authorize(self.p,self.rom,'C09000','C09003')

    def test_out_of_range_mapper(self):
        with self.assertRaisesRegex(ValueError,'LoROM'):
            m.authorize(self.p,self.rom,'C09000','C09003',mapper='lorom') if False else m.rom_offset(0xC00002,'lorom')

if __name__ == '__main__':unittest.main()
