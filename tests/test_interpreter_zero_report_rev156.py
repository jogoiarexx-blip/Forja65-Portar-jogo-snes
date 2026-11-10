"""Forja65 REV156 generation contract: explicit zero-fallback report."""
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class InterpreterZeroReportGeneration(unittest.TestCase):
    def test_generator_unconditionally_writes_zero_counts(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('Node.js is not installed')
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'interpreter.cpp'
            subprocess.run([node, str(ROOT/'tools/gen-cpu-interpreter.js'), str(out),
                            '--core', str(ROOT/'forja65-core.js')],
                           check=True, capture_output=True, text=True, timeout=30)
            src = out.read_text()
            self.assertIn('auto&s=forja65_interp_stats();std::ofstream f(path', src)
            self.assertNotIn('if(!s.blocks)return', src)
            self.assertIn('FORJA65_CPU_INTERPRETER 1', src)
            self.assertIn('\\ninstructions=', src)
            self.assertIn('stats.instructions+=n;', src)


if __name__ == '__main__':
    unittest.main()
