#!/usr/bin/env python3
"""Regression tests for strict replay comparisons, including truncated CSVs."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1] / 'tools' / 'compare-frame-traces.py'
spec = importlib.util.spec_from_file_location('forja_frame_compare', TOOL)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FrameComparisonTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def csv(self, name, rows):
        path = self.root / name
        path.write_text('frame,pc,joy1,joy2,autojoy1,autojoy2,instructions,nmi,fb_fnv1a64\n' +
                        '\n'.join(rows) + '\n', encoding='utf-8')
        return path

    def test_exact_match(self):
        a = self.csv('a.csv', ['40,abcd,0,0,0,0,100,1,ff', '80,beef,0,0,0,0,200,2,aa'])
        b = self.csv('b.csv', ['40,abcd,0,0,0,0,100,1,ff', '80,beef,0,0,0,0,200,2,aa'])
        self.assertTrue(module.compare(a, b, through_frame=80)['match'])

    def test_first_mismatch(self):
        a = self.csv('a.csv', ['40,abcd,0,0,0,0,100,1,ff'])
        b = self.csv('b.csv', ['40,abcd,0,0,0,0,100,1,00'])
        got = module.compare(a, b)
        self.assertFalse(got['match'])
        self.assertEqual(got['first_difference']['field'], 'fb_fnv1a64')

    def test_checkpoint_missing(self):
        a = self.csv('a.csv', ['40,abcd,0,0,0,0,100,1,ff', '80,beef,0,0,0,0,200,2,aa'])
        b = self.csv('b.csv', ['80,beef,0,0,0,0,200,2,aa'])
        self.assertEqual(module.compare(a, b)['missing_in_candidate'], [40])

    def test_truncation_rejected(self):
        a = self.csv('a.csv', ['40,abcd,0,0,0,0,100,1,ff', '80,beef,0,0,0,0,200,2,aa'])
        b = self.csv('b.csv', ['40,abcd,0,0,0,0,100,1,ff'])
        with self.assertRaisesRegex(ValueError, 'both logs must reach'):
            module.compare(a, b, through_frame=80)

    def test_non_monotonic_rejected(self):
        a = self.csv('a.csv', ['80,abcd,0,0,0,0,100,1,ff', '40,beef,0,0,0,0,200,2,aa'])
        with self.assertRaisesRegex(ValueError, 'non-increasing'):
            module.load(a)


if __name__ == '__main__':
    unittest.main()
