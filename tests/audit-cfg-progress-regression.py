#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'tools/audit-cfg-progress.py'
s=importlib.util.spec_from_file_location('audit',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Tests(unittest.TestCase):
    def compare(self, before, after):
        with tempfile.TemporaryDirectory() as d:
            a,b=Path(d)/'a',Path(d)/'b';a.write_text(before);b.write_text(after)
            return m.compare(a,b)
    def test_same_frame_more_instructions(self):
        r=self.compare('frames=5359\ninstructions=81644862\nlast_cpu_pc=0xc0c048\n', 'frames=5359\ninstructions=81644870\nlast_cpu_pc=0xc0c04b\n')
        self.assertEqual(r['delta_instructions'],8)
        self.assertTrue(r['runtime_advanced'])
        self.assertFalse(r['gameplay_validated'])
    def test_same_runtime_not_advance(self):
        s='frames=10\ninstructions=10\nlast_cpu_pc=0x100\n'
        self.assertFalse(self.compare(s,s)['runtime_advanced'])
    def test_regression(self):
        self.assertEqual(self.compare('frames=5\ninstructions=100\nlast_cpu_pc=0x100\n','frames=4\ninstructions=110\nlast_cpu_pc=0x101\n')['status'],'regression_or_incomparable')
    def test_more_frames(self):
        self.assertEqual(self.compare('frames=5\ninstructions=100\nlast_cpu_pc=0x100\n','frames=6\ninstructions=140\nlast_cpu_pc=0x101\n')['status'],'more_frames')
    def test_bad_input_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'bad';p.write_text('frames=3\ninstructions=0\n')
            with self.assertRaises(ValueError):m.read_failure(p)
    def test_duplicates_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'bad';p.write_text('frames=3\nframes=4\ninstructions=0\nlast_cpu_pc=0x1\n')
            with self.assertRaises(ValueError):m.read_failure(p)
if __name__=='__main__':unittest.main()
