"""Regression tests for shot windows: all proofs are hypotheses-only."""
import csv
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'tools'))
from wram_shot_windows_v20 import replay_shots, schedule, analyze, SIZE


class ShotWindowTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root=Path(self.tmp.name)
        self.a=root/'attack';self.b=root/'baseline'
        self.a.mkdir();self.b.mkdir()
        self.frames=[0,9,10,20,24,25,35,49]
        for folder in (self.a,self.b):
            (folder/'forja65-qa-status.txt').write_text('rom=c5c657071aadfc1d\nframes=50\nruntime_started=PASS\n')
            with (folder/'snapshots.csv').open('w',newline='') as handle:
                writer=csv.writer(handle);writer.writerow(['frame','file','pc','joy1','bytes'])
                for frame in self.frames:
                    name=f'wram-{frame:08d}.bin'
                    data=bytearray(SIZE)
                    if folder==self.a and frame>=10:data[0x0940]=1
                    if folder==self.a and frame>=25:data[0x0940]=2
                    if folder==self.b and frame>=10:data[0x0258]=frame
                    if folder==self.a and frame>=10:data[0x0258]=frame
                    (folder/name).write_bytes(data)
                    writer.writerow([frame,name,'808000',0,SIZE])
        self.trace=root/'input.trace'
        self.trace.write_text('# test\nframe=1 joy1=0000 joy2=0000\nframe=10 joy1=8000 joy2=0000\nframe=11 joy1=0000 joy2=0000\nframe=25 joy1=8000 joy2=0000\nframe=26 joy1=0000 joy2=0000\nframe=5000 joy1=8000 joy2=0000\n')

    def test_replay_shots_rising_edges_and_long_trace(self):
        self.assertEqual(replay_shots(self.trace,10,50),[10,25])

    def test_schedule_has_pres_and_must_fit(self):
        snap=schedule([10,25],10,50)
        self.assertIn(9,snap);self.assertIn(10,snap);self.assertIn(24,snap);self.assertIn(25,snap)
        self.assertEqual(len(snap),len(set(snap)))
        with self.assertRaises(ValueError):schedule(list(range(10,100,4)),10,150)

    def test_real_wrams_and_only_attack_addresses(self):
        result=analyze(self.b,self.a,[10,25])
        self.assertEqual(result['validated']['collision'],False)
        self.assertEqual(result['validated']['board_clear'],False)
        self.assertEqual(result['validated']['next_stage'],False)
        row=next(x for x in result['candidates'] if x['address']=='7E0940')
        self.assertEqual(row['attack_only_shot_windows'],2)
        self.assertEqual(result['candidate_count'],1)
        self.assertEqual(result['windows'][0]['attack_only_temporal_changes'],1)

    def test_first_shot_horizon(self):
        result=analyze(self.b,self.a,[10],horizon=25)
        self.assertEqual(result['windows'][0]['delayed_frame'],24)
        self.assertEqual(result['last_shot_horizon_exclusive'],25)

    def test_no_forged_prefork_equality(self):
        file=self.a/'wram-00000009.bin'; blob=bytearray(file.read_bytes());blob[1]=99;file.write_bytes(blob)
        with self.assertRaisesRegex(ValueError,'before fork'):analyze(self.b,self.a,[10,25])

    def test_invalid_qa_fingerprint(self):
        qa=self.b/'forja65-qa-status.txt';qa.write_text(qa.read_text().replace('c5c657071aadfc1d','other'))
        with self.assertRaisesRegex(ValueError,'ROM mismatch'):analyze(self.b,self.a,[10,25])

    def test_missing_post_evidence(self):
        file=self.b/'wram-00000035.bin';file.unlink()
        with self.assertRaises((OSError,ValueError)):analyze(self.b,self.a,[10,25])

    def test_malformed_duplicate_trace_frame(self):
        with self.trace.open('a') as handle:handle.write('frame=26 joy1=8000 joy2=0000\n')
        # The frames after 50 are ignored but the earlier sequence must still be valid.
        self.assertEqual(replay_shots(self.trace,10,50),[10,25])
        self.trace.write_text('frame=1 joy1=0000 joy2=0000\nframe=10 joy1=8000 joy2=0000\nframe=10 joy1=0000 joy2=0000\n')
        with self.assertRaises(ValueError):replay_shots(self.trace,10,50)


if __name__=='__main__':unittest.main()
