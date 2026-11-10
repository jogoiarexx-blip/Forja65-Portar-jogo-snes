#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path

p = Path(__file__).resolve().parents[1] / 'tools' / 'audit-visual-stall.py'
spec = importlib.util.spec_from_file_location('audit_visual_stall',p)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
H='frame,pc,joy1,joy2,autojoy1,autojoy2,instructions,nmi,fb_fnv1a64\n'

def entry(f,hash='aaa',nmi=None,joy='0',ins=None):
    return f'{f},c04830,{joy},0,{joy},0,{ins if ins is not None else f*200},{nmi if nmi is not None else f},{hash}\n'

class VisualStallRegression(unittest.TestCase):
    def run_audit(self, body, **args):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'trace.csv';p.write_text(body)
            return m.audit(p,**args)
    def test_stall_with_cpu_nmi_and_input(self):
        result=self.run_audit(H+entry(5400)+entry(5500)+entry(5650,joy='8100')+entry(5720,joy='8100'),start=5400)
        self.assertEqual(result['status'],'static_visual_with_active_cpu')
        self.assertEqual(result['span_frames'],320)
        self.assertTrue(result['input_during_static_window'])
    def test_changing_image(self):
        result=self.run_audit(H+entry(5400)+entry(5600,'bbb')+entry(5800,'ccc'))
        self.assertEqual(result['status'],'no_confirmed_long_static_window')
    def test_paused_nmi(self):
        result=self.run_audit(H+entry(5400,nmi=50)+entry(5720,nmi=50))
        self.assertNotEqual(result['status'],'static_visual_with_active_cpu')
    def test_missing_columns(self):
        with self.assertRaises(ValueError):self.run_audit('frame,nmi\n1,1\n')
    def test_reordered_frames(self):
        with self.assertRaises(ValueError):self.run_audit(H+entry(120)+entry(80))
    def test_window_filter(self):
        result=self.run_audit(H+entry(5100)+entry(5400,'z')+entry(5550,'z'),start=5350,end=5600)
        self.assertEqual(result['span_frames'],150)
    def test_insufficient_samples(self):
        result=self.run_audit(H+entry(5100),start=5000)
        self.assertEqual(result['status'],'insufficient_samples')

if __name__=='__main__':unittest.main()
