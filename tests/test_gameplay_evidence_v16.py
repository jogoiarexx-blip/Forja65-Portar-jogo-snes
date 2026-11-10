#!/usr/bin/env python3
"""Negative tests for gameplay evidence gate (no false collision/score awards)."""
from pathlib import Path
import importlib.util
import tempfile
import unittest
import wave

SPEC=importlib.util.spec_from_file_location('gate',Path(__file__).resolve().parents[1]/'tools'/'gameplay_evidence_v16.py')
gate=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(gate)

def ppm(path,blob):
    path.write_bytes(b'P6\n4 2\n255\n'+blob)


class EvidenceGateTest(unittest.TestCase):
    def setUp(self):
        self.dir=tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        d=Path(self.dir.name)
        self.a=d/'a.ppm';self.b=d/'b.ppm';self.ta=d/'a.trace';self.tb=d/'b.trace'
        ppm(self.a,b'\0'*24)
        ppm(self.b,b'\xff'*3+b'\0'*21)
        self.ta.write_text('frame=5 joy1=1000 joy2=0000\nframe=10 joy1=0000 joy2=0000\n')
        self.tb.write_text('frame=5 joy1=1000 joy2=0000\nframe=10 joy1=0000 joy2=0000\nframe=20 joy1=8000 joy2=0000\n')
        self.reg={'board':[0,0,1,1],'shooter':[1,0,2,1],'score':[2,0,3,1]}

    def test_gate_never_proves_scoring_or_collision(self):
        r=gate.evaluate(self.a,self.b,self.reg,self.ta,self.tb,20)
        self.assertTrue(r['observations']['board_visual_changed'])
        self.assertFalse(r['observations']['score_visual_changed'])
        self.assertEqual(r['gameplay_validation']['bubble_collision'],'not_independently_proven')
        self.assertEqual(r['gameplay_validation']['stage_transition'],'not_independently_proven')

    def test_identical_controls_rejected(self):
        with self.assertRaisesRegex(ValueError,'never diverge'):
            gate.evaluate(self.a,self.b,self.reg,self.ta,self.ta,20)

    def test_different_controls_before_fork_rejected(self):
        self.tb.write_text('frame=5 joy1=8000 joy2=0000\nframe=20 joy1=0000 joy2=0000\n')
        with self.assertRaisesRegex(ValueError,'before fork'):
            gate.evaluate(self.a,self.b,self.reg,self.ta,self.tb,20)

    def test_different_frames_rejected(self):
        ppm(self.b,b'\0'*27)
        with self.assertRaisesRegex(ValueError,'Invalid/truncated'):
            gate.evaluate(self.a,self.b,self.reg)

    def test_bad_roi_rejected(self):
        with self.assertRaisesRegex(ValueError,'outside picture'):
            gate.evaluate(self.a,self.b,{'board':[0,0,5,2]})

    def test_pre_fork_image_mismatch_rejected(self):
        with self.assertRaisesRegex(ValueError,'already differ'):
            gate.evaluate(self.a,self.b,self.reg,pre_base=self.a,pre_variant=self.b)

    def test_wav_detects_first_difference_but_not_fidelity(self):
        pa=Path(self.dir.name)/'a.wav';pb=Path(self.dir.name)/'b.wav'
        for p,stream in [(pa,b'\0'*400),(pb,b'\0'*200+b'\1'+b'\0'*199)]:
            with wave.open(str(p),'wb') as w:
                w.setnchannels(2);w.setsampwidth(2);w.setframerate(32000);w.writeframes(stream)
        result=gate.compare_audio(pa,pb)
        self.assertTrue(result['different'])
        self.assertFalse(result['audio_fidelity_proven'])
        self.assertAlmostEqual(result['first_different_second'],50/32000,places=4)

    def test_malformed_trace_rejected(self):
        self.ta.write_text('frame=5 joy1=G000 joy2=0000\n')
        with self.assertRaisesRegex(ValueError,'Invalid trace'):
            gate.validate_fork(self.ta,self.tb,20)

if __name__=='__main__':unittest.main()
