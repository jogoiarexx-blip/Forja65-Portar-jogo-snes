"""REV156: explicit no-fallback telemetry and native milestone regression tests."""
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / 'tools/verify_native_replay_rev156.py'
spec = importlib.util.spec_from_file_location('native_milestones_rev156', FILE)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)


def write_snapshot(folder, frame=600, rom='aabb', fb='abcd', wram='1234', blocks=0, instructions=0):
    folder.mkdir(parents=True, exist_ok=True)
    (folder/'forja65-qa-status.txt').write_text(
        f'FORJA65_QA 1\nrom={rom}\nruntime_started=PASS\nframes={frame}\n'
        f'instructions=9000\nnmi_services=3\nirq_services=2\n'
        f'wram_hash={wram}\nframebuffer_hash={fb}\n')
    (folder/'forja65-cpu-interpreter.txt').write_text(
        f'FORJA65_CPU_INTERPRETER 1\nblocks={blocks}\ninstructions={instructions}\n'
        '# entrada estado(E/M/X) origem execucoes\n')


class NativeMilestones(unittest.TestCase):
    def test_matching_zero_is_accepted(self):
        with tempfile.TemporaryDirectory() as d:
            r, c = Path(d)/'r', Path(d)/'c'
            write_snapshot(r); write_snapshot(c)
            out = mod.verify({600: mod.load_snapshot(r, 600)}, {600: mod.load_snapshot(c, 600)}, True)
            self.assertTrue(out['pass']); self.assertEqual(out['milestones'][0]['native_observed_pct'], 100.0)

    def test_missing_report_is_never_assumed_zero(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d); write_snapshot(path)
            (path/'forja65-cpu-interpreter.txt').unlink()
            with self.assertRaisesRegex(ValueError, 'missing mandatory'):
                mod.load_snapshot(path, 600)

    def test_bad_state_fails(self):
        with tempfile.TemporaryDirectory() as d:
            r, c = Path(d)/'r', Path(d)/'c'
            write_snapshot(r); write_snapshot(c, wram='2345')
            self.assertFalse(mod.verify({600: mod.load_snapshot(r)}, {600: mod.load_snapshot(c)}, True)['pass'])

    def test_nonzero_interpreter_fails_zero_requirement(self):
        with tempfile.TemporaryDirectory() as d:
            r, c = Path(d)/'r', Path(d)/'c'
            write_snapshot(r); write_snapshot(c, blocks=5, instructions=20)
            self.assertFalse(mod.verify({600: mod.load_snapshot(r)}, {600: mod.load_snapshot(c)}, True)['pass'])

    def test_missing_milestones_rejected(self):
        with self.assertRaisesRegex(ValueError, 'milestone'):
            mod.verify({600: {}}, {5000: {}})

    def test_duplicate_field_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d); write_snapshot(path)
            p = path/'forja65-qa-status.txt'
            p.write_text(p.read_text()+'frames=600\n')
            with self.assertRaisesRegex(ValueError, 'duplicate'):
                mod.load_snapshot(path)

    def test_corrupt_counts_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d); write_snapshot(path, blocks=1, instructions=0)
            with self.assertRaisesRegex(ValueError, 'inconsistent'):
                mod.load_snapshot(path)

    def test_wrong_frame_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d); write_snapshot(path)
            with self.assertRaisesRegex(ValueError, 'expected frame'):
                mod.load_snapshot(path, 5000)

    def test_wrong_rom_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            r, c = Path(d)/'r', Path(d)/'c'
            write_snapshot(r); write_snapshot(c, rom='other')
            with self.assertRaisesRegex(ValueError, 'ROM changed'):
                mod.verify({600: mod.load_snapshot(r)}, {600: mod.load_snapshot(c)}, True)


if __name__ == '__main__':
    unittest.main()
