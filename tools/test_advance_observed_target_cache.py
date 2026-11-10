#!/usr/bin/env python3
"""Regression for bounded cache capacity growth without loss of analyzed routes."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).with_name('advance-observed-target.py')
spec = importlib.util.spec_from_file_location('advance_observed_target', MODULE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class CacheGrowthTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.base = Path(self.dir.name)
        self.args = (self.base, self.base/'cart-data.bin', self.base/'observed.txt',
                     self.base/'generated', 8192, 8192)

    def test_ceiling_retry_preserves_budget(self):
        with patch.object(m, 'run', side_effect=[
            ValueError('node failed (2): CFG cache variant ceiling (9689 > 8192); refuse to evict previously decoded routines silently'),
            object()]) as call:
            limit = m.run_analysis_with_cache_retry(*self.args)
        self.assertEqual(limit, 16384)
        self.assertEqual(call.call_count, 2)
        original, retry = [args[0][0] for args in call.call_args_list]
        self.assertEqual(original[original.index('--max')+1], '8192')
        self.assertEqual(retry[retry.index('--max')+1], '8192')
        self.assertEqual(original[original.index('--cache-limit')+1], '8192')
        self.assertEqual(retry[retry.index('--cache-limit')+1], '16384')

    def test_reject_cache_above_hard_ceiling(self):
        with patch.object(m, 'run', side_effect=ValueError('CFG cache variant ceiling (50001 > 8192)')) as call:
            with self.assertRaisesRegex(ValueError, '50001'):
                m.run_analysis_with_cache_retry(*self.args)
        self.assertEqual(call.call_count, 1)

    def test_other_errors_are_not_retried(self):
        with patch.object(m, 'run', side_effect=ValueError('ROM fingerprint mismatch')) as call:
            with self.assertRaisesRegex(ValueError, 'ROM fingerprint'):
                m.run_analysis_with_cache_retry(*self.args)
        self.assertEqual(call.call_count, 1)

    def test_failed_output_is_not_clobbered(self):
        self.args[3].mkdir()
        with patch.object(m, 'run', side_effect=ValueError('CFG cache variant ceiling (9689 > 8192)')) as call:
            with self.assertRaisesRegex(ValueError, 'generation directory already exists'):
                m.run_analysis_with_cache_retry(*self.args)
        self.assertEqual(call.call_count, 1)

    def test_no_retry_when_capacity_sufficient(self):
        with patch.object(m, 'run', return_value=object()) as call:
            self.assertEqual(m.run_analysis_with_cache_retry(*self.args), 8192)
        self.assertEqual(call.call_count, 1)


if __name__ == '__main__':
    unittest.main()
