import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('capture_integrity', ROOT / 'get-ready-capture-integrity.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class CaptureIntegrityTest(unittest.TestCase):
    def make(self, folder, name, frames):
        columns = sorted(mod.SPECS[name])
        with (folder/name).open('w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
            for frame in frames:
                writer.writerow({col: (frame if col == 'frame' else 'x') for col in columns})

    def test_missing_capture_fails(self):
        with tempfile.TemporaryDirectory() as t:
            self.assertFalse(mod.analyze(Path(t))['capture_valid'])

    def test_nonoverlapping_timeline_fails(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t)
            for name in mod.SPECS:
                self.make(p, name, [100] if name == 'writers.csv' else [500])
            self.assertFalse(mod.analyze(p)['capture_valid'])

    def test_overlapping_timeline_passes(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t)
            for name in mod.SPECS:
                self.make(p, name, [100, 101])
            self.assertTrue(mod.analyze(p)['capture_valid'])

    def test_bad_frame_fails(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t)
            for name in mod.SPECS:
                self.make(p, name, [-1])
            self.assertFalse(mod.analyze(p)['capture_valid'])

    def test_overlapping_ranges_without_shared_frames_fails(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t)
            for name in mod.SPECS:
                frames = [100, 300] if name == 'writers.csv' else [150, 250]
                self.make(p, name, frames)
            self.assertFalse(mod.analyze(p)['capture_valid'])

if __name__ == '__main__': unittest.main()
