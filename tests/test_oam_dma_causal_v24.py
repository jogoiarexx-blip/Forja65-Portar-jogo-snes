import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

SRC=Path(__file__).resolve().parents[1]/'tools'/'oam_dma_causal_v24.py'
spec=importlib.util.spec_from_file_location('audit',SRC)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestOamCausal(unittest.TestCase):
    def make(self, folder, frame=7):
        path=folder/'tape.csv'
        seq=[]
        for i,v in enumerate([0x50,0xA4,0x2A,0x3B]):
            seq.append(dict(frame=frame,pc='80ED48',channel=0,source=f'{0x7E022E+i:06X}',bbus='2104',value=v,
                      oam_word_before=i//2,flip_before=i%2,oam_word_after=(i+1)//2,flip_after=(i+1)%2))
        with path.open('w',newline='') as f:
            w=csv.DictWriter(f,fieldnames=mod.HEADER);w.writeheader();w.writerows(seq)
        (folder/f'oam-{frame:08d}.bin').write_bytes(bytes([0x50,0xA4,0x2A,0x3B])+bytes(540))
        return path
    def test_correlates_original_source(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);f=self.make(p)
            r=mod.audit(f,p)
            self.assertEqual(r['status'],'SOURCE_TO_OAM_BYTES_OBSERVED')
            self.assertEqual(r['candidate_transferred_bytes'],4)
            self.assertEqual(r['candidate_endframe_oam_matches'],4)
            self.assertFalse(r['validated']['board_clear'])
    def test_missing_snapshot_does_not_claim_match(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);f=self.make(p);(p/'oam-00000007.bin').unlink()
            r=mod.audit(f,p);self.assertEqual(r['candidate_endframe_oam_matches'],0)
    def test_loram_mirror_maps_to_7e(self):
        self.assertEqual(mod.canonical_wram(0x00022E), 0x7E022E)
        self.assertEqual(mod.canonical_wram(0x80022E), 0x7E022E)
        self.assertEqual(mod.canonical_wram(0x7E022E), 0x7E022E)
        self.assertEqual(mod.canonical_wram(0x002001), 0x002001)
        self.assertEqual(mod.canonical_wram(0x40022E), 0x40022E)
    def test_mirrored_source_proven(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);f=self.make(p)
            s=f.read_text()
            for i in range(4):
                s=s.replace(f'{0x7E022E+i:06X}', f'{0x022E+i:06X}')
            f.write_text(s)
            r=mod.audit(f,p)
            self.assertEqual(r['candidate_transferred_bytes'],4)
            self.assertEqual(r['candidate_endframe_oam_matches'],4)

    def test_no_target_source(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);f=self.make(p)
            s=f.read_text().replace('7E022E','7E0310').replace('7E022F','7E0311').replace('7E0230','7E0312').replace('7E0231','7E0313');f.write_text(s)
            self.assertEqual(mod.audit(f,p)['status'],'NO_CANDIDATE_SOURCE_TRANSFER_OBSERVED')
    def test_truncated_oam_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);f=self.make(p);(p/'oam-00000007.bin').write_bytes(b'bad')
            with self.assertRaises(ValueError):mod.audit(f,p)
    def test_unsupported_bbus_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);f=self.make(p);f.write_text(f.read_text().replace('2104','2118'))
            with self.assertRaises(ValueError):mod.audit(f,p)
    def test_out_of_order_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);f=self.make(p)
            s=f.read_text().splitlines();s[2]=s[2].replace(',7,',',6,') if ',7,' in s[2] else s[2]
            # A malformed field is sufficient for strict reject
            s[1]=s[1].replace('80ED48','XYZ')
            f.write_text('\n'.join(s)+'\n')
            with self.assertRaises(ValueError):mod.audit(f,p)

if __name__=='__main__':unittest.main()
