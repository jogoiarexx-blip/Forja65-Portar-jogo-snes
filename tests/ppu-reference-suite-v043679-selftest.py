"""Tests for v79 hardened capture manifest, synchronization and reference intake.

The test fixtures are synthetic and NOT actual Mesen-S or hardware captures.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
TOOL=ROOT/'tools'/'ppu-reference-suite-v043679.py'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ppm(rgb,w=3,h=2):
    return f'P6\n{w} {h}\n255\n'.encode()+rgb*(w*h)


class ReferenceSuite(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.root.joinpath('reference').mkdir()
        self.root.joinpath('actual').mkdir()
        (self.root/'reference'/'frame0.ppm').write_bytes(ppm(b'\x12\x23\x34'))
        (self.root/'actual'/'frame0.ppm').write_bytes(ppm(b'\x12\x23\x34'))
        self.assertEqual(self.cli('init','--bundle',str(self.root)).returncode,0)
        self.path=self.root/'manifest.json'
        self.doc=json.loads(self.path.read_text())
        case=self.doc['cases'][0]
        case['reference'].update(producer='SyntheticReferenceInTest',producer_version='test-fixture',kind='forja65_internal',capture_method='synthetic test bytes')
        sync=case['reference_sync']
        sync.update(rom_sha256='a'*64, input_replay_sha256='b'*64,checkpoint_id='reset+input-replay-test',
                    frame_number=10,field='none',bg_mode=0,setini_2133=0,video_standard='NTSC',
                    viewport='raw-no-overlay-no-crop',width=3,height=2)
        case['actual_sync']=sync.copy()
        self.save()

    def cli(self,*args):
        return subprocess.run([sys.executable,str(TOOL),*args],capture_output=True,text=True,timeout=20)

    def save(self):
        self.path.write_text(json.dumps(self.doc,indent=2)+'\n')

    def verify(self,*opts):
        return self.cli('verify','--manifest',str(self.path),'--output-dir',str(self.root/'results'),*opts)

    def summary(self):
        return json.loads((self.root/'results'/'summary.json').read_text())

    def test_template_wont_claim_sync(self):
        self.cli('init','--bundle',str(self.root),'--overwrite')
        result=self.verify()
        self.assertEqual(result.returncode,2)
        self.assertIn('rom_sha256',result.stderr)

    def test_template_hashes_both_images(self):
        c=self.doc['cases'][0]
        self.assertEqual(c['reference']['sha256'],sha((self.root/'reference/frame0.ppm').read_bytes()))
        self.assertEqual(c['actual']['sha256'],sha((self.root/'actual/frame0.ppm').read_bytes()))

    def test_identical_capture(self):
        r=self.verify()
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(self.summary()['total_different_pixels'],0)
        self.assertFalse(self.summary()['independent_reference_verified'])

    def test_external_required_rejects_internal(self):
        r=self.verify('--require-external')
        self.assertEqual(r.returncode,2)
        self.assertIn('require external',r.stderr)

    def test_external_claim_is_not_certified(self):
        c=self.doc['cases'][0]
        c['reference'].update(producer='Mesen-S (fake label in synthetic unit test)', producer_version='synthetic-test-1', kind='external_emulator')
        self.save()
        r=self.verify('--require-external')
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertFalse(self.summary()['independent_reference_verified'])
        self.assertIn('operator-declared',self.summary()['provenance'])

    def test_detect_different_pixel_and_heatmap(self):
        file=self.root/'actual/frame0.ppm'
        file.write_bytes(ppm(b'\x13\x23\x34'))
        self.doc['cases'][0]['actual']['sha256']=sha(file.read_bytes())
        self.save()
        r=self.verify()
        self.assertEqual(r.returncode,1,r.stderr)
        self.assertEqual(self.summary()['total_different_pixels'],6)
        self.assertEqual(self.summary()['cases'][0]['appearance'],'widespread')
        self.assertTrue((self.root/'results/frame0-heatmap.ppm').is_file())

    def test_capture_tampering_rejected(self):
        (self.root/'actual/frame0.ppm').write_bytes(ppm(b'\x99\x00\x00'))
        r=self.verify()
        self.assertEqual(r.returncode,2)
        self.assertIn('SHA-256 mismatch',r.stderr)
        self.assertFalse((self.root/'results/summary.json').exists())

    def test_bad_rom_sync_rejected(self):
        self.doc['cases'][0]['actual_sync']['rom_sha256']='f'*64
        self.save()
        r=self.verify()
        self.assertEqual(r.returncode,2)
        self.assertIn('sync mismatch',r.stderr)

    def test_bad_field_rejected(self):
        self.doc['cases'][0]['actual_sync']['field']='odd'
        self.save()
        self.assertEqual(self.verify().returncode,2)

    def test_invalid_field_enum(self):
        for name in ('reference_sync','actual_sync'):
            self.doc['cases'][0][name]['field']='second'
        self.save()
        self.assertEqual(self.verify().returncode,2)

    def test_path_traversal_rejected(self):
        self.doc['cases'][0]['actual']['path']='../out.ppm'
        self.save()
        self.assertEqual(self.verify().returncode,2)

    def test_missing_reference_producer_version(self):
        self.doc['cases'][0]['reference']['producer_version']=''
        self.save()
        self.assertEqual(self.verify().returncode,2)

    def test_dimensions_mismatch_rejected(self):
        for key in ('reference_sync','actual_sync'):
            self.doc['cases'][0][key]['width']=256
        self.save()
        self.assertEqual(self.verify().returncode,2)

    def test_roi_zero_difference(self):
        file=self.root/'actual/frame0.ppm'
        data=bytearray(file.read_bytes())
        data[-1]^=7
        file.write_bytes(data)
        self.doc['cases'][0]['actual']['sha256']=sha(data)
        self.doc['cases'][0]['roi']=[0,0,1,1]
        self.save()
        self.assertEqual(self.verify().returncode,0)

    def test_two_fields_in_one_suite(self):
        self.doc['cases'][0]['reference_sync']['field']='even'
        self.doc['cases'][0]['actual_sync']['field']='even'
        second=json.loads(json.dumps(self.doc['cases'][0]))
        second['id']='frame1'
        for name in ('reference','actual'):
            source=self.root/second[name]['path']
            other=source.with_name('frame1.ppm')
            other.write_bytes(source.read_bytes())
            second[name]['path']=f'{name}/{other.name}'
            second[name]['sha256']=sha(other.read_bytes())
        second['reference_sync']['field']='odd'
        second['actual_sync']['field']='odd'
        second['reference_sync']['frame_number']=11
        second['actual_sync']['frame_number']=11
        self.doc['cases'].append(second)
        self.save()
        r=self.verify()
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(self.summary()['capture_count'],2)
        self.assertEqual([c['sync']['field'] for c in self.summary()['cases']],['even','odd'])

    def test_duplicate_case_rejected(self):
        self.doc['cases'].append(self.doc['cases'][0].copy())
        self.save()
        self.assertEqual(self.verify().returncode,2)

    def test_threshold_compensates_one_channel(self):
        file=self.root/'actual/frame0.ppm'
        file.write_bytes(ppm(b'\x13\x23\x34'))
        self.doc['cases'][0]['actual']['sha256']=sha(file.read_bytes())
        self.doc['cases'][0]['threshold']=1
        self.save()
        self.assertEqual(self.verify().returncode,0)

    def test_wrong_image_codec_rejected(self):
        file=self.root/'actual/frame0.ppm'
        file.write_bytes(b'not a ppm')
        self.doc['cases'][0]['actual']['sha256']=sha(file.read_bytes())
        self.save()
        self.assertEqual(self.verify().returncode,2)

    def test_actual_producer_must_be_forja65(self):
        self.doc['cases'][0]['actual']['producer']='OtherEmulator'
        self.save()
        r=self.verify()
        self.assertEqual(r.returncode,2)
        self.assertIn('Forja65 producer',r.stderr)

    def test_field_mismatch_from_setini_rejected(self):
        self.doc['cases'][0]['actual_sync']['setini_2133']=2
        self.save()
        self.assertEqual(self.verify().returncode,2)

    def test_output_folder_not_capture_folder(self):
        r=self.cli('verify','--manifest',str(self.path),'--output-dir',str(self.root/'reference'))
        self.assertEqual(r.returncode,2)

    def test_reject_manifest_overwrite_without_optin(self):
        self.assertEqual(self.cli('init','--bundle',str(self.root)).returncode,2)

    def test_same_reference_actual_file_rejected(self):
        case=self.doc['cases'][0]
        case['actual']['path']=case['reference']['path']
        case['actual']['sha256']=case['reference']['sha256']
        self.save()
        result=self.verify()
        self.assertEqual(result.returncode,2)
        self.assertIn('same file',result.stderr)

    def test_hardlink_alias_rejected(self):
        source=self.root/'reference/frame0.ppm'
        original=self.root/'actual/frame0.ppm'
        original.unlink()
        import os
        os.link(source,original)
        result=self.verify()
        self.assertEqual(result.returncode,2)
        self.assertIn('same file',result.stderr)

    def test_cross_case_reuse_rejected(self):
        other=json.loads(json.dumps(self.doc['cases'][0]))
        other['id']='other'
        # Identical image bytes but intentionally alias an input file from case 0.
        other['reference']['path']='actual/frame0.ppm'
        other['reference']['sha256']=sha((self.root/'actual/frame0.ppm').read_bytes())
        (self.root/'actual/other.ppm').write_bytes((self.root/'actual/frame0.ppm').read_bytes())
        other['actual']['path']='actual/other.ppm'
        self.doc['cases'].append(other)
        self.save()
        result=self.verify()
        self.assertEqual(result.returncode,2)
        self.assertIn('reused as reference',result.stderr)

    def test_cross_case_hardlink_reuse_rejected(self):
        import os
        other=json.loads(json.dumps(self.doc['cases'][0]))
        other['id']='other'
        alias=self.root/'reference'/'alias.ppm'
        os.link(self.root/'actual'/'frame0.ppm',alias)
        other['reference']['path']='reference/alias.ppm'
        other['reference']['sha256']=sha(alias.read_bytes())
        target=self.root/'actual'/'other.ppm'
        target.write_bytes((self.root/'actual/frame0.ppm').read_bytes())
        other['actual']['path']='actual/other.ppm'
        self.doc['cases'].append(other)
        self.save()
        result=self.verify()
        self.assertEqual(result.returncode,2)
        self.assertIn('reused as reference',result.stderr)

    def test_nested_output_inside_reference_rejected(self):
        result=self.cli('verify','--manifest',str(self.path),
                        '--output-dir',str(self.root/'reference'/'nested'))
        self.assertEqual(result.returncode,2)
        self.assertIn('overlaps input',result.stderr)
        self.assertFalse((self.root/'reference'/'nested').exists())

    def test_output_parent_of_inputs_rejected(self):
        result=self.cli('verify','--manifest',str(self.path),
                        '--output-dir',str(self.root.parent))
        self.assertEqual(result.returncode,2)
        self.assertIn('overlaps input',result.stderr)

    def test_independent_identical_bytes_allowed(self):
        # Equal pixel data and SHA-256 are valid for two distinct capture files.
        result=self.verify()
        self.assertEqual(result.returncode,0,result.stderr)

if __name__=='__main__':
    unittest.main(verbosity=2)
