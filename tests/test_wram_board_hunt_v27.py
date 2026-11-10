"""Snapshot triage tests: rank input effects, never certify gameplay semantics."""
import csv
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_board_hunt_v27 import analyze, normalize_ranges

F=(9,10,12,20)
def make(folder, *, shot=False,rom='rom-A',broken=False,pre_damage=False):
    folder.mkdir(parents=True,exist_ok=True)
    (folder/'forja65-qa-status.txt').write_text('rom='+rom+'\nframes=22\nruntime_started=PASS\n')
    with (folder/'snapshots.csv').open('w',newline='') as out:
        w=csv.writer(out);w.writerow(['frame','file','pc','joy1','bytes'])
        for f in F:
            data=bytearray(131072)
            if shot and f>=10:
                data[0x0120]=1                 # excluded sprite scratch
                data[0x0330]=4                 # retained low-RAM candidate
                data[0x10031]=6                 # $7F kept as secondary
            if shot and pre_damage and f==9:data[0x0330]=55
            fn=f'wram-{f:08d}.bin';blob=bytes(data)
            if shot and broken and f==12:blob=blob[:-1]
            (folder/fn).write_bytes(blob)
            w.writerow([f,fn,'80ABCD',0,131072])

class BoardHuntTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.p=Path(self.tmp.name)
        make(self.p/'baseline');make(self.p/'attack',shot=True)
        (self.p/'baseline.trace').write_text('frame=0 joy1=0000 joy2=0000\n')
        (self.p/'attack.trace').write_text('frame=0 joy1=0000 joy2=0000\nframe=10 joy1=8000 joy2=0000\n')
    def run_hunt(self,**kw):
        opts={'baseline':self.p/'baseline','attack':self.p/'attack','fork':10,'horizon':22,
              'excluded':[{'start':'7E0100','end':'7E01FF','reason':'synthetic-shadow'}],
              'baseline_trace':self.p/'baseline.trace','attack_trace':self.p/'attack.trace',
              'tile':32,'top':8,'writer_cap':20}
        opts.update(kw);return analyze(**opts)
    def test_filtered_rank_preserves_graphics_without_gameplay_claims(self):
        x=self.run_hunt()
        self.assertTrue(x['fire_only_inputs_verified'])
        self.assertEqual(x['excluded_divergent_bytes_by_reason']['synthetic-shadow'],1)
        self.assertEqual(x['ranked_7e_regions'][0]['start'],'7E0320')
        self.assertEqual(x['ranked_7f_regions'][0]['start'],'7F0020')
        self.assertEqual(x['selected_writer_addresses'],['7E0330'])
        self.assertFalse(any(x['validated'][k] for k in ('board','collision','score','board_cleared','next_stage')))
    def test_wrong_rom_rejected(self):
        (self.p/'attack'/'forja65-qa-status.txt').write_text('rom=wrong\nframes=22\nruntime_started=PASS\n')
        with self.assertRaisesRegex(ValueError,'ROM'):self.run_hunt()
    def test_pre_fork_full_ram_mismatch_rejected(self):
        make(self.p/'attack',shot=True,pre_damage=True)
        with self.assertRaisesRegex(ValueError,'pre-fork'):self.run_hunt()
    def test_partial_image_rejected(self):
        make(self.p/'attack',shot=True,broken=True)
        with self.assertRaisesRegex(ValueError,'partial'):self.run_hunt()
    def test_nonfire_input_divergence_rejected(self):
        (self.p/'attack.trace').write_text('frame=0 joy1=0000 joy2=0000\nframe=10 joy1=8100 joy2=0000\n')
        with self.assertRaisesRegex(ValueError,'non-fire'):self.run_hunt()
    def test_duplicate_exclusions_rejected(self):
        with self.assertRaisesRegex(ValueError,'overlapping'):
            self.run_hunt(excluded=['7E0100-7E01FF','7E0180-7E0200'])
    def test_exclusion_bounds_rejected(self):
        with self.assertRaisesRegex(ValueError,'outside'):
            normalize_ranges(['7D0000-7D0100'])
    def test_traces_must_be_paired(self):
        with self.assertRaisesRegex(ValueError,'both replay traces'):
            self.run_hunt(attack_trace=None)
    def test_qa_missing_frame_rejected(self):
        (self.p/'attack'/'forja65-qa-status.txt').write_text('rom=rom-A\nframes=20\nruntime_started=PASS\n')
        with self.assertRaisesRegex(ValueError,'QA'):self.run_hunt()
    def test_no_semantic_claim_when_no_diff(self):
        make(self.p/'attack',shot=False)
        x=self.run_hunt()
        self.assertEqual(x['selected_writer_addresses'],[])
        self.assertEqual(x['bank_7e_region_count'],0)
        self.assertFalse(x['validated']['board'])

if __name__=='__main__':unittest.main()
