import csv
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from wram_record_probe_v25 import analyze, IMAGE_SIZE, load

class TestRecordProbe(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.source=0x100
        self.dest=0x200
        self.rows=b''.join((0xD80F).to_bytes(2,'little')+i.to_bytes(2,'little')+(i+3).to_bytes(2,'little') for i in range(6))
        for side in ('baseline','attack'):
            folder=self.root/side;folder.mkdir()
            (folder/'forja65-qa-status.txt').write_text('rom=testrom\nframes=30\nruntime_started=PASS\n')
            with (folder/'snapshots.csv').open('w',newline='') as fd:
                w=csv.writer(fd);w.writerow(['frame','file','pc','joy1','bytes'])
                for frame in (4,5,10,20):
                    ram=bytearray(IMAGE_SIZE)
                    ram[self.source:self.source+len(self.rows)]=self.rows
                    ram[self.dest:self.dest+len(self.rows)]=self.rows
                    if side=='attack' and frame>=10:
                        ram[self.dest+2]=0x50
                        if frame==10:ram[self.dest]=0xCC
                    name=f'wram-{frame:08d}.bin';(folder/name).write_bytes(ram)
                    w.writerow([frame,name,'80ED48','0',IMAGE_SIZE])
    def report(self):
        return analyze(self.root/'baseline',self.root/'attack',fork=8,start=self.dest,count=6,tag_offset=0)
    def test_observed_copy_and_mutation(self):
        r=self.report()
        self.assertEqual(r['first_observed_changed_record_frame'],10)
        self.assertEqual(r['first_observed_changed_tag_frame'],10)
        self.assertEqual(r['initial_exact_copy_locations'],['7E0100'])
        self.assertEqual(r['unchanged_copy_locations_in_all_snapshots'],['7E0100'])
        self.assertFalse(r['validated']['board_clear'])
        self.assertFalse(r['validated']['score'])
        self.assertEqual(r['timeline'][-1]['changed_records_ab'],1)
        self.assertIn('7E0202',r['suggested_writer_filters'][0])
    def test_prefix_changed_rejected(self):
        p=self.root/'attack'/'wram-00000005.bin';v=bytearray(p.read_bytes());v[4]^=1;p.write_bytes(v)
        with self.assertRaisesRegex(ValueError,'prefix'):self.report()
    def test_wrong_rom_rejected(self):
        (self.root/'attack'/'forja65-qa-status.txt').write_text('rom=another\nframes=30\nruntime_started=PASS\n')
        with self.assertRaisesRegex(ValueError,'ROM'):self.report()
    def test_truncated_snapshot_rejected(self):
        (self.root/'attack'/'wram-00000010.bin').write_bytes(b'bad')
        with self.assertRaisesRegex(ValueError,'incomplete'):self.report()
    def test_bad_manifest_path_rejected(self):
        p=self.root/'attack'/'snapshots.csv';p.write_text(p.read_text().replace('wram-00000010.bin','../evil.bin'))
        with self.assertRaisesRegex(ValueError,'frame/name'):self.report()
    def test_duplicate_rejected(self):
        p=self.root/'attack'/'snapshots.csv';p.write_text(p.read_text()+p.read_text().splitlines()[-1]+'\n')
        with self.assertRaisesRegex(ValueError,'unordered'):self.report()
    def test_no_structure_rejected(self):
        with self.assertRaisesRegex(ValueError,'repeated tag'):analyze(self.root/'baseline',self.root/'attack',8,0x300,6,tag_offset=0)
    def test_out_of_range_rejected(self):
        with self.assertRaisesRegex(ValueError,'outside WRAM'):analyze(self.root/'baseline',self.root/'attack',8,IMAGE_SIZE-4,6)
    def test_no_false_semantics(self):
        r=self.report()
        self.assertFalse(r['validated']['board_cells'])
        self.assertFalse(r['validated']['collision'])
        self.assertFalse(r['validated']['next_stage'])
    def test_unknown_tag_slot(self):
        with self.assertRaisesRegex(ValueError,'stride'):analyze(self.root/'baseline',self.root/'attack',8,self.dest,6,tag_offset=6)

if __name__=='__main__':unittest.main()
