#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('gap',Path(__file__).with_name('audit-static-call-gaps.py'))
gap=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gap)


class TestStaticCallGaps(unittest.TestCase):
    def setUp(self):
        self.rom=bytearray(0x20000)
        self.rom[0x0100:0x0103]=bytes([0x20,0x20,0x81])  # C0:0100 JSR C0:8120
        self.rom[0x0110:0x0114]=bytes([0x22,0x20,0x81,0xC0]) # C0:0110 JSL C0:8120
        self.shard='// $C00100 JSR -> $C08120 stack real\n// $C00110 JSL -> $C08120 stack real'
        self.dispatch='{0xC08120u,false,false,false,false,false,&sub_C08120,0xC08120u},'

    def test_verified_registered(self):
        result=gap.scan(bytes(self.rom),self.shard,self.dispatch,'HiROM')
        self.assertEqual(result['call_sites_verified'],2)
        self.assertEqual(result['missing_targets'],[])
        self.assertFalse(result['runtime_execution_certified'])

    def test_detects_missing(self):
        result=gap.scan(bytes(self.rom),self.shard,'','HiROM')
        self.assertEqual(result['missing_targets'],['C08120'])

    def test_corrupted_opcode_rejected(self):
        self.rom[0x100]=0
        result=gap.scan(bytes(self.rom),self.shard,self.dispatch,'HiROM')
        self.assertEqual(len(result['invalid_rom_sites']),1)
        self.assertEqual(result['call_sites_verified'],1)

    def test_caller_bank_matters_for_jsr(self):
        result=gap.scan(bytes(self.rom),'// $C00100 JSR -> $C18120',self.dispatch,'HiROM')
        self.assertEqual(len(result['invalid_rom_sites']),1)

    def test_no_generated_execution_claim(self):
        result=gap.scan(bytes(self.rom),self.shard,self.dispatch,'HiROM')
        self.assertFalse(any(row['runtime_observed'] for row in result['candidates']))


if __name__=='__main__':unittest.main()
