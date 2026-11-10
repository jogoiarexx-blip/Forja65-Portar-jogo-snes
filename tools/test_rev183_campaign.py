#!/usr/bin/env python3
"""REV183: no false native claims from incomplete/mismatched campaign logs."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parent

def load(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

runner = load('campaign_runner', 'verify-native-campaign.py')
compare = load('campaign_compare', 'compare-native-campaign.py')


def fixture(folder: Path, mode: str, hashes=None, fallback=0):
    folder.mkdir()
    (folder / 'segment-0000').mkdir()
    settings = dict(mode=mode, profile='reference', trace_sha256='abc',
                    rom_sha256='def', game_sha256='ghi', frames=3,
                    chunk=3, fallback_counter='reset')
    (folder / 'manifest.json').write_text(json.dumps(dict(status='complete',
        settings=settings, segments=[dict(folder='segment-0000', frame=3, checkpoint=None)])))
    seg = folder / 'segment-0000'
    (seg / 'forja65-qa-status.txt').write_text('FORJA65_QA 1\nframes=3\n')
    (seg / 'forja65-cpu-migration.txt').write_text(f'FORJA65_CPU_MIGRATION 1\ntotal_instructions=100\ninterpreter_instructions={fallback}\n')
    if hashes is None:
        hashes = [(i, 'aaa', f'{i:03x}') for i in range(3)]
    (seg / 'frame-hashes.txt').write_text(''.join(f'frame={i} framebuffer={fb} wram={wram} pc=abcd\n' for i, fb, wram in hashes))
    (folder / 'audit.json').write_text(json.dumps(runner.audit(folder)))


class TestNativeCampaign(unittest.TestCase):
    def test_matching_campaigns(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);fixture(root/'normal','normal');fixture(root/'strict','aot')
            result=compare.compare(root/'normal',root/'strict')
            self.assertTrue(result['equal'])
            self.assertEqual(result['verified_frames'],3)

    def test_first_divergence_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);fixture(root/'normal','normal')
            fixture(root/'strict','aot', [(0,'aaa','000'),(1,'aaa','999'),(2,'aaa','002')])
            self.assertEqual(compare.compare(root/'normal',root/'strict')['first_mismatch_frame'],1)

    def test_rejects_different_trace(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);fixture(root/'normal','normal');fixture(root/'strict','aot')
            p=root/'strict'/'manifest.json'; data=json.loads(p.read_text());data['settings']['trace_sha256']='different';p.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,'different trace_sha256'):
                compare.compare(root/'normal',root/'strict')

    def test_incomplete_frame_hashes_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);fixture(root/'normal','normal')
            hashes=root/'normal'/'segment-0000'/'frame-hashes.txt'
            hashes.write_text('\n'.join(hashes.read_text().splitlines()[:2])+'\n')
            self.assertEqual(runner.audit(root/'normal')['frames'],2)
            with self.assertRaisesRegex(ValueError,'incomplete hash coverage'):
                fixture_dir=root/'strict';fixture(fixture_dir,'aot')
                compare.compare(root/'normal',fixture_dir)

    def test_discontinuous_frame_hashes_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            with self.assertRaisesRegex(ValueError,'frame discontinuity'):
                fixture(root/'wrong','aot',[(0,'aaa','000'),(2,'aaa','001')])

    def test_checkpoint_counter_modes(self):
        # Separate processes: legacy DKC3 resets this counter, newer Forja persists it.
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); fixture(root/'reset','aot',fallback=8)
            self.assertEqual(runner.audit(root/'reset')['interpreted_instructions'],8)
            p=root/'reset'/'manifest.json'; data=json.loads(p.read_text());data['settings']['fallback_counter']='persistent';p.write_text(json.dumps(data))
            self.assertEqual(runner.audit(root/'reset')['interpreted_instructions'],8)

if __name__=='__main__':
    unittest.main()
