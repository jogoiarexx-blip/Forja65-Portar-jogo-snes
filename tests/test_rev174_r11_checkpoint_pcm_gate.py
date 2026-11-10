#!/usr/bin/env python3
"""Detect silent corruption in the R11 cold/resume gate."""
import importlib.util
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import wave

TOOL = Path(__file__).resolve().parents[1] / 'tools' / 'rev174_r11_checkpoint_pcm_gate.py'
spec = importlib.util.spec_from_file_location('gate', TOOL)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def record(cold):
    pcm = struct.pack('<' + 'h'*600, *range(600))
    frames = {i: ('1a', hex(i)[2:], 'ee') for i in range(120,300)}
    s = {'qa': {'frames': '300', 'instructions': '50000', 'framebuffer_hash': '1a', 'wram_hash': 'f1',
                'nmi_services': '200', 'irq_services':'0'},
         'dep': {'cpu_interpreter_instructions':'0', 'cpu_aot_instructions':'50000',
                 'ppu_writes':'100', 'rom_fallback_reads':'0', 'dma_bytes':'100', 'hdma_bytes':'20',
                 'apu_aot_instructions':'5000', 'apu_aot_spc_cycles':'20000',
                 'apu_interpreter_spc_cycles':'0', 'dsp_native_samples':'10000'},
         'hashes': frames,
         'pcm': (150 if not cold else 300, pcm[-600:] if not cold else pcm)}
    return s

class R11GateTests(unittest.TestCase):
    def test_full_parity(self):
        self.assertEqual(mod.audit(record(True),record(False),120,300)['status'],'PASS')
    def test_pcm_corruption_is_failure(self):
        ref, resumed = record(True),record(False)
        resumed['pcm'] = (150, resumed['pcm'][1][:-1] + b'\x00')
        self.assertEqual(mod.audit(ref,resumed,120,300)['status'],'FAIL')
    def test_wram_frame_corruption_is_failure(self):
        ref, resumed = record(True),record(False)
        resumed['hashes'][230] = ('1a','bad','ee')
        result = mod.audit(ref,resumed,120,300)
        self.assertEqual(result['status'],'FAIL')
        self.assertEqual(result['frame_hash_mismatches'],1)
    def test_frame_disappearance_is_failure(self):
        ref, resumed = record(True),record(False)
        del resumed['hashes'][199]
        self.assertEqual(mod.audit(ref,resumed,120,300)['status'],'FAIL')
    def test_cpu_fallback_detected(self):
        ref, resumed = record(True),record(False)
        resumed['dep']['cpu_interpreter_instructions'] = '1'
        self.assertEqual(mod.audit(ref,resumed,120,300)['status'],'FAIL')
    def test_duplicate_and_invalid_frame_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)/'frames.txt'
            p.write_text('frame=120 framebuffer=aa wram=bb pc=cc\nframe=120 framebuffer=aa wram=bb pc=cc\n')
            with self.assertRaisesRegex(ValueError,'Duplicate'):
                mod.indexed_frames(p)
            p.write_text('frame=120 framebuffer=aa wram=bb pc=NOT-HEX\n')
            with self.assertRaisesRegex(ValueError,'Invalid'):
                mod.indexed_frames(p)
    def test_wave_format_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)/'bad.wav'
            with wave.open(str(p), 'wb') as f:
                f.setnchannels(1); f.setsampwidth(2);f.setframerate(44100);f.writeframes(b'\x00\x00')
            with self.assertRaisesRegex(ValueError,'Unexpected PCM'):
                mod.pcm(p)

if __name__ == '__main__': unittest.main()
