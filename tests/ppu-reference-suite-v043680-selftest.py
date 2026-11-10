"""v80 regressions incl. v79 guards; synthetic fixtures, no external oracle."""
import hashlib
import json
from pathlib import Path
import unittest

# Reuse all 29 inherited reference-manifest safety cases, but execute v80.
import importlib.util
_PREVIOUS = Path(__file__).with_name('ppu-reference-suite-v043679-selftest.py')
_spec = importlib.util.spec_from_file_location('reference_suite_v79_tests', _PREVIOUS)
_prev = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_prev)
_prev.TOOL = Path(__file__).resolve().parents[1] / 'tools/ppu-reference-suite-v043680.py'


def patterned_image(w=80,h=64):
    result=bytearray()
    for y in range(h):
        for x in range(w):
            result += bytes(((17*x+3*y+x*y)%256, (7*x+23*y)%256, (13*x*y+37)%256))
    return bytes(result)


def shifted(rgb, w, h, dx, dy):
    out=bytearray(w*h*3)
    for y in range(h):
        for x in range(w):
            sx, sy = x-dx, y-dy
            if 0<=sx<w and 0<=sy<h:
                out[(y*w+x)*3:(y*w+x)*3+3]=rgb[(sy*w+sx)*3:(sy*w+sx)*3+3]
    return bytes(out)


class SyncDiagnostics(_prev.ReferenceSuite):
    """Inherits all base tests; add tests with textured full-size scenes."""

    def setup_pattern(self, actual=None):
        w,h = 80,64
        rgb=patterned_image(w,h)
        for target,payload in (('reference',rgb),('actual',actual if actual is not None else rgb)):
            path=self.root/target/'frame0.ppm'
            blob=f'P6\n{w} {h}\n255\n'.encode()+payload
            path.write_bytes(blob)
            self.doc['cases'][0][target]['sha256']=hashlib.sha256(blob).hexdigest()
        for name in ('reference_sync','actual_sync'):
            self.doc['cases'][0][name].update(width=w,height=h)
        self.save()
        return rgb

    def test_spatial_one_pixel_shift_is_diagnostic_not_a_fix(self):
        pattern=patterned_image()
        self.setup_pattern(shifted(pattern,80,64,1,0))
        result=self.verify()
        self.assertEqual(result.returncode,1,result.stderr)
        case=self.summary()['cases'][0]
        self.assertGreater(case['different_pixels'],0)
        self.assertEqual(case['sync_diagnostics']['spatial']['candidate']['dx'],1)
        self.assertEqual(case['sync_diagnostics']['spatial']['candidate']['dy'],0)
        self.assertFalse(self.summary()['matched'])

    def test_spatial_vertical_shift(self):
        pattern=patterned_image()
        self.setup_pattern(shifted(pattern,80,64,0,-1))
        self.assertEqual(self.verify().returncode,1)
        c=self.summary()['cases'][0]['sync_diagnostics']['spatial']['candidate']
        self.assertEqual((c['dx'],c['dy']),(0,-1))

    def test_flat_scene_no_false_shift(self):
        # Full-frame single color change cannot prove a spatial offset.
        self.setup_pattern(actual=bytes([20,20,20])*(80*64))
        self.assertEqual(self.verify().returncode,1)
        d=self.summary()['cases'][0]['sync_diagnostics']['spatial']
        self.assertIsNone(d['candidate'])

    def test_matching_frame_no_shift(self):
        self.setup_pattern()
        self.assertEqual(self.verify().returncode,0)
        self.assertIsNone(self.summary()['cases'][0]['sync_diagnostics']['spatial']['candidate'])

    def make_neighbor(self, mismatch_rom=False):
        pattern=patterned_image()
        other=bytes(((c+43)%256) for c in pattern)
        self.setup_pattern(actual=other)
        original = self.doc['cases'][0]
        candidate = json.loads(json.dumps(original))
        candidate['id'] = 'frame1'
        for side in ('reference','actual'):
            path=self.root/side/'frame1.ppm'
            data=b'P6\n80 64\n255\n'+other
            path.write_bytes(data)
            candidate[side]['path'] = f'{side}/frame1.ppm'
            candidate[side]['sha256']=hashlib.sha256(data).hexdigest()
        candidate['reference_sync']['frame_number']=11
        candidate['actual_sync']['frame_number']=11
        if mismatch_rom:
            candidate['reference_sync']['rom_sha256']='e'*64
            candidate['actual_sync']['rom_sha256']='e'*64
        self.doc['cases'].append(candidate)
        self.save()

    def test_temporal_adjacent_frame_hinted_without_masking_failure(self):
        self.make_neighbor()
        result=self.verify()
        self.assertEqual(result.returncode,1,result.stderr)
        c=self.summary()['cases'][0]
        d=c['sync_diagnostics']['temporal']
        self.assertEqual(d['classification'],'possible_temporal_offset')
        self.assertEqual(d['candidate']['frame_delta'],1)
        self.assertEqual(d['candidate']['reference_case_id'],'frame1')
        self.assertGreater(c['different_pixels'],0)

    def test_temporal_does_not_cross_rom_identity(self):
        self.make_neighbor(mismatch_rom=True)
        self.assertEqual(self.verify().returncode,1)
        self.assertIsNone(self.summary()['cases'][0]['sync_diagnostics']['temporal']['candidate'])

    def test_disable_diagnostics_preserves_verdict(self):
        pattern=patterned_image()
        self.setup_pattern(shifted(pattern,80,64,1,0))
        self.assertEqual(self.verify('--skip-sync-diagnostics').returncode,1)
        summary=self.summary()
        self.assertFalse(summary['sync_diagnostics_enabled'])
        self.assertEqual(summary['cases'][0]['sync_diagnostics'],{'enabled':False})


if __name__=='__main__':
    unittest.main(verbosity=2)
