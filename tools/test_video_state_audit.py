import csv
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
from video_state_audit import inspect,COLUMNS

class VideoAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'trace.csv'
    def write(self, items):
        with self.path.open('w',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=COLUMNS);writer.writeheader()
            for i,data in enumerate(items):
                row={k:'0' for k in COLUMNS};row.update({'frame':str(i),'pc':'c0abcd','framebuffer':'F','wram':'W',
                  'vram':'V','cgram':'C','oam':'O','ppu_writes':str(i*4), 'dma_bytes':str(i*64)})
                row.update(data);writer.writerow(row)
    def test_wram_dynamic_video_static(self):
        self.write([{'wram':str(i)} for i in range(4)])
        result=inspect(self.path)
        self.assertEqual(result['status'],'static_image_wram_changed_video_memory_static')
        self.assertEqual(result['counter_deltas']['dma_bytes'],192)
    def test_video_memory_dynamic(self):
        self.write([{'vram':str(i)} for i in range(3)])
        self.assertEqual(inspect(self.path)['status'],'static_image_video_memory_changed')
    def test_framebuffer_changes(self):
        self.write([{'framebuffer':str(i)} for i in range(3)])
        self.assertEqual(inspect(self.path)['status'],'framebuffer_changed')
    def test_static_all(self):
        self.write([{},{}]);self.assertEqual(inspect(self.path)['status'],'static_image_memory_unchanged')
    def test_window(self):
        self.write([{'framebuffer':'D' if i>3 else 'F'} for i in range(5)])
        self.assertEqual(inspect(self.path,0,3)['status'],'static_image_memory_unchanged')
    def test_one_row(self):
        self.write([{}]);self.assertEqual(inspect(self.path)['status'],'insufficient_samples')
    def test_bad_frame_order(self):
        self.write([{}, {'frame':'0'}]);self.assertRaises(ValueError,inspect,self.path)
    def test_bad_counter(self):
        self.write([{'ppu_writes':'9'},{'ppu_writes':'8'}]);self.assertRaises(ValueError,inspect,self.path)
    def test_missing_field(self):
        self.path.write_text('frame,pc\n0,c0abcd\n1,c0abcd\n');self.assertRaises(ValueError,inspect,self.path)
    def test_bad_window(self):
        self.write([{},{}]);self.assertRaises(ValueError,inspect,self.path,5,2)

if __name__=='__main__':unittest.main()
