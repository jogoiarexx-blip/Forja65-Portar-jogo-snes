"""Synthetic regression tests; tests do NOT certify the real game's rules."""
import csv
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_isolated_shot_v21 import scan,input_isolation
from wram_snapshot_ab_v19 import SIZE

class IsolatedShotTests(unittest.TestCase):
    def setUp(self):
        t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);self.root=Path(t.name)
        self.a=self.root/'a';self.b=self.root/'b';self.a.mkdir();self.b.mkdir()
        self.frames=[0,9,10,11,15,20,24,26]
        for folder in (self.a,self.b):
            (folder/'forja65-qa-status.txt').write_text('rom=0123456789ABCDEF\nframes=27\nruntime_started=PASS\n')
            with (folder/'snapshots.csv').open('w',newline='') as stream:
                w=csv.writer(stream);w.writerow(['frame','file','pc','joy1','bytes'])
                for frame in self.frames:
                    data=bytearray(SIZE)
                    if frame>=10 and folder==self.a:data[0x910]=1
                    if frame>=15 and folder==self.a:data[0x7ffe]=2
                    if frame>=20 and folder==self.a:data[0x10001]=3
                    if frame in (10,11) and folder==self.a:data[0x1000]=5
                    if frame>=15:data[0x6]=3  # unrelated, identical baseline and attack
                    name=f'wram-{frame:08d}.bin';(folder/name).write_bytes(data)
                    w.writerow([frame,name,'808000',32768 if folder==self.a and frame==10 else 0,SIZE])
        self.bt=self.root/'b.trace';self.at=self.root/'a.trace'
        self.bt.write_text('frame=0 joy1=0000 joy2=0000\nframe=12 joy1=0100 joy2=0000\nframe=18 joy1=0000 joy2=0000\nframe=25 joy1=8000 joy2=0000\n')
        self.at.write_text('frame=0 joy1=0000 joy2=0000\nframe=10 joy1=8000 joy2=0000\nframe=11 joy1=0000 joy2=0000\nframe=12 joy1=0100 joy2=0000\nframe=18 joy1=0000 joy2=0000\nframe=25 joy1=8000 joy2=0000\n')
    def check(self):return scan(self.b,self.a,self.bt,self.at,10,25)
    def test_first_shot_isolation_and_delay(self):
        r=self.check();self.assertEqual(r['status'],'ISOLATED_SHOT_WRAM_EFFECT_CONFIRMED')
        self.assertEqual(r['summary']['immediate_at_fork'],2)
        self.assertEqual(r['summary']['7f_candidates'],1)
        row=next(x for x in r['ranked_addresses'] if x['address']=='7E0910')
        self.assertEqual(row['first_divergence_frame'],10)
        self.assertTrue(row['attack_only_temporal_change'])
        self.assertFalse(r['validated']['collision'])
        self.assertNotIn(26,r['checkpoint_frames_in_window'])
    def test_nonfire_divergence_refused(self):
        self.at.write_text(self.at.read_text().replace('frame=12 joy1=0100','frame=12 joy1=0200'))
        with self.assertRaisesRegex(ValueError,'non-fire'):self.check()
    def test_different_second_controller_refused(self):
        self.at.write_text(self.at.read_text().replace('frame=12 joy1=0100 joy2=0000','frame=12 joy1=0100 joy2=0010'))
        with self.assertRaisesRegex(ValueError,'non-fire'):self.check()
    def test_missing_immediate_checkpoint_refused(self):
        (self.a/'wram-00000010.bin').unlink()
        with self.assertRaises((OSError,ValueError)):self.check()
    def test_mismatched_prefork_wram_refused(self):
        file=self.a/'wram-00000009.bin';x=bytearray(file.read_bytes());x[1]=42;file.write_bytes(x)
        with self.assertRaisesRegex(ValueError,'before fork'):self.check()
    def test_wrong_rom_refused(self):
        q=self.a/'forja65-qa-status.txt';q.write_text(q.read_text().replace('0123456789ABCDEF','xxx'))
        with self.assertRaisesRegex(ValueError,'ROM'):self.check()
    def test_wrong_fork_refused(self):
        with self.assertRaisesRegex(ValueError,'not at fork'):scan(self.b,self.a,self.bt,self.at,9,25)
    def test_duplicate_trace_refused(self):
        self.at.write_text(self.at.read_text()+'frame=25 joy1=8000 joy2=0000\n')
        with self.assertRaisesRegex(ValueError,'duplicate'):self.check()
    def test_baseline_fire_refused(self):
        self.bt.write_text(self.bt.read_text().replace('frame=12 joy1=0100','frame=12 joy1=8100'))
        with self.assertRaises(ValueError):self.check()

if __name__=='__main__':unittest.main()
