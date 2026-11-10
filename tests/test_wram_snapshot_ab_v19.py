import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_snapshot_ab_v19 import analyze,load_snapshots,SIZE

class TestSnapshots(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        for side in ('b','a'):
            folder=self.root/side;folder.mkdir()
            (folder/'forja65-qa-status.txt').write_text('rom=demo\nframes=40\nruntime_started=PASS\n')
            with (folder/'snapshots.csv').open('w',newline='') as f:
                w=csv.writer(f);w.writerow(['frame','file','pc','joy1','bytes'])
                for frame in (4,5,10,20):
                    contents=bytearray(SIZE)
                    if side=='a' and frame>=10:
                        contents[0x940]=4
                        contents[0x2000]=6
                    file=f'wram-{frame:08d}.bin'
                    (folder/file).write_bytes(contents)
                    w.writerow([frame,file,'80ABCD',0,SIZE])
    def tearDown(self):self.temp.cleanup()
    def test_ab(self):
        result=analyze(self.root/'b',self.root/'a',8)
        self.assertEqual(result['total_different_addresses'],2)
        self.assertTrue(result['pre_fork_full_wram_equal'])
        self.assertEqual(result['next_stage'],'NOT_PROVEN')
    def test_before_fork_wrong(self):
        (self.root/'a'/'wram-00000005.bin').write_bytes(bytes([1])*SIZE)
        with self.assertRaisesRegex(ValueError,'before input fork'):analyze(self.root/'b',self.root/'a',8)
    def test_truncated(self):
        (self.root/'a'/'wram-00000020.bin').write_bytes(b'not full')
        with self.assertRaisesRegex(ValueError,'partial'):load_snapshots(self.root/'a')
    def test_mismatched_rom(self):
        (self.root/'a'/'forja65-qa-status.txt').write_text('rom=other\nframes=40\nruntime_started=PASS\n')
        with self.assertRaisesRegex(ValueError,'fingerprints'):analyze(self.root/'b',self.root/'a',8)
    def test_mismatched_frames(self):
        (self.root/'a'/'wram-00000020.bin').unlink()
        with self.assertRaisesRegex(FileNotFoundError,'wram-00000020'):analyze(self.root/'b',self.root/'a',8)
    def test_malicious_filename(self):
        file=self.root/'a'/'snapshots.csv'
        s=file.read_text().replace('wram-00000010.bin','../bad.bin')
        file.write_text(s)
        with self.assertRaisesRegex(ValueError,'unordered/invalid'):load_snapshots(self.root/'a')
    def test_duplicate_frame(self):
        file=self.root/'a'/'snapshots.csv';text=file.read_text();file.write_text(text+text.splitlines()[-1]+'\n')
        with self.assertRaisesRegex(ValueError,'unordered'):load_snapshots(self.root/'a')

if __name__=='__main__':unittest.main()
