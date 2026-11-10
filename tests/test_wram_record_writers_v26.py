"""WRAM writer-chain test: synthetic traces must never imply a cleared board."""
import csv
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_record_writers_v26 import analyze

HEAD=['frame','address','old','new','writer_pc','bus','joy1','nmi']

def make(root, side, writes=(), rom='R001', damage=False):
    folder=root/side;folder.mkdir()
    (folder/'forja65-qa-status.txt').write_text('rom='+rom+'\nframes=22\nruntime_started=PASS\n')
    with (folder/'writers.csv').open('w',newline='') as fd:
        w=csv.writer(fd);w.writerow(HEAD)
        for f,addr,old,new in writes:w.writerow([f,addr,old,new,'80FA01','bus','32768','4'])
    ram=bytearray(131072)
    with (folder/'snapshots.csv').open('w',newline='') as fd:
        w=csv.writer(fd);w.writerow(['frame','file','pc','joy1','bytes'])
        for f in (9,10,15,20):
            for ef,addr,old,new in writes:
                if ef<=f:ram[int(addr,16)-0x7e0000]=new
            if damage and f==15:ram[0x112]=255
            path=f'wram-{f:08}.bin';(folder/path).write_bytes(ram)
            w.writerow([f,path,'80FA01',0,131072])

class WRAMRecordWriterTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        make(self.root,'baseline')
        make(self.root,'attack',[(10,'7E0112',0,6),(15,'7E0112',6,8),(20,'7E0114',0,1)])
    def analyze(self,**kw):
        args=dict(control=self.root/'baseline',attack=self.root/'attack',targets=['7E0112','7E0114'],
            start=0x110,count=4,stride=6,window_start=10,window_end=20,
            requested_frames=22,fork=10,expected_rom='R001')
        args.update(kw);return analyze(**args)
    def test_chain_counts_and_semantics(self):
        result=self.analyze()
        self.assertEqual(result['captured']['attack']['events'],3)
        self.assertEqual(result['writers'][0]['record_indices'],[0])
        self.assertEqual(result['writers'][0]['word_slots_affected'],[1,2])
        self.assertEqual(result['first_observed_ab_change'],10)
        self.assertTrue(result['validated']['writer_snapshot_chain'])
        for key in ('collision','score','board_clear','next_stage','board_cells'):
            self.assertFalse(result['validated'][key])
    def test_missing_write_rejected(self):
        p=self.root/'attack'/'writers.csv'
        p.write_text('\n'.join(p.read_text().splitlines()[:-1])+'\n')
        with self.assertRaisesRegex(ValueError,'snapshot'):self.analyze()
    def test_wrong_rom_rejected(self):
        with self.assertRaisesRegex(ValueError,'ROM'):self.analyze(expected_rom='WRONG')
    def test_bad_layout_rejected(self):
        with self.assertRaisesRegex(ValueError,'outside'):self.analyze(start=0x120)
    def test_duplicate_filters_rejected(self):
        with self.assertRaisesRegex(ValueError,'duplicate'):self.analyze(targets=['7E0112','7E0112'])
    def test_stack_opcode_classification(self):
        rom=bytearray(32768)
        rom[0x7a01]=0x48  # 80FA01 PHA, stack push
        r=self.analyze(rom=bytes(rom))
        self.assertEqual(r['opcode_audit']['classification'],'ALL_WRITES_FROM_STACK_PUSH_OPCODES')
        self.assertEqual(r['opcode_audit']['stack_opcode_events']['attack'],3)
        self.assertFalse(r['opcode_audit']['can_use_as_board_evidence'])
    def test_nonstack_opcode_is_not_marked_stack(self):
        rom=bytearray(32768);rom[0x7a01]=0x99  # STA abs,Y not necessarily stack
        r=self.analyze(rom=bytes(rom))
        self.assertEqual(r['opcode_audit']['classification'],'UNCLASSIFIED_OR_MIXED')
    def test_no_rom_must_not_guess_stack(self):
        r=self.analyze()
        self.assertEqual(r['opcode_audit']['classification'],'UNCLASSIFIED_OR_MIXED')
    def test_wrong_qa_rejected(self):
        p=self.root/'attack'/'forja65-qa-status.txt'
        p.write_text(p.read_text().replace('R001','R002'))
        with self.assertRaisesRegex(ValueError,'ROM'):self.analyze()
    def test_corrupted_snapshot_rejected(self):
        p=self.root/'attack'/'wram-00000015.bin'
        ram=bytearray(p.read_bytes());ram[0x112]=255;p.write_bytes(ram)
        with self.assertRaisesRegex(ValueError,'snapshot'):self.analyze()
    def test_missing_writers_rejected(self):
        (self.root/'attack'/'writers.csv').unlink()
        with self.assertRaisesRegex(ValueError,'writer CSV missing'):self.analyze()

if __name__=='__main__':unittest.main()
