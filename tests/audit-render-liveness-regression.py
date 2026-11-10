#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'audit-render-liveness.py'
spec = importlib.util.spec_from_file_location('audit_render_liveness', MODULE)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class TestRenderLiveness(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.p = Path(self.temp.name) / 'p.csv'
        self.h = Path(self.temp.name) / 'h.txt'
        self.p.write_text('frame,pc,instructions,nmi,fb_fnv1a64\n'
                          '100,c04849,10000,100,abcd\n'
                          '200,c04849,12000,200,abcd\n'
                          '300,c04849,15000,300,abcd\n', encoding='utf-8')

    def test_changed_wram_while_pixels_static(self):
        self.h.write_text('frame=99 framebuffer=abcd wram=11 pc=c04849\n'
                          'frame=199 framebuffer=abcd wram=11 pc=c04849\n'
                          'frame=299 framebuffer=abcd wram=22 pc=c04849\n')
        r = audit.diagnose(self.p, self.h)
        self.assertEqual(r['status'], 'static_image_but_wram_changed')
        self.assertEqual(r['wram_unique_hashes'], 2)

    def test_constant_wram(self):
        self.h.write_text('frame=99 framebuffer=abcd wram=11 pc=0\n'
                          'frame=299 framebuffer=abcd wram=11 pc=0\n')
        self.assertEqual(audit.diagnose(self.p, self.h)['status'], 'static_image_and_wram_unchanged')

    def test_absent_hash_is_not_claimed(self):
        self.assertEqual(audit.diagnose(self.p)['status'], 'static_image_with_active_cpu_no_wram_evidence')

    def test_short_span(self):
        self.assertEqual(audit.diagnose(self.p, min_span=300)['status'], 'no_long_visual_plateau')

    def test_missing_columns(self):
        self.p.write_text('frame,pc\n1,2\n')
        with self.assertRaisesRegex(ValueError,'columns'):
            audit.diagnose(self.p)

    def test_duplicate_frame_hash(self):
        self.h.write_text('frame=99 framebuffer=a wram=b pc=1\n'
                          'frame=99 framebuffer=a wram=b pc=1\n')
        with self.assertRaisesRegex(ValueError,'Duplicate'):
            audit.diagnose(self.p,self.h)

    def test_non_monotonic_progress(self):
        self.p.write_text('frame,pc,instructions,nmi,fb_fnv1a64\n100,1,1,1,abc\n100,2,2,2,abc\n')
        with self.assertRaisesRegex(ValueError,'increase'):
            audit.diagnose(self.p)

if __name__ == '__main__':
    unittest.main()
