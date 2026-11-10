import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE=Path(__file__).with_name('gameplay-evidence-audit.py')
spec=importlib.util.spec_from_file_location('evidence_audit',MODULE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ReplayAuditTests(unittest.TestCase):
    def setUp(self):
        self.d=tempfile.TemporaryDirectory()
        self.file=Path(self.d.name)/'progress.csv'

    def tearDown(self):
        self.d.cleanup()

    def write(self, rows):
        with self.file.open('w',newline='') as f:
            w=csv.writer(f); w.writerow(['frame','instructions','nmi','joy1','fb_fnv1a64']);w.writerows(rows)

    def test_static_screen_with_input_not_playable(self):
        self.write([[1,100,1,'8100','aa'],[2,200,2,'8100','aa']])
        v=mod.audit(self.file)
        self.assertEqual(v['status'],'static_render_with_input')
        self.assertFalse(v['gameplay_verified'])

    def test_visual_change_with_input_not_playable(self):
        self.write([[1,100,1,'8100','aa'],[2,200,2,'8100','bb']])
        v=mod.audit(self.file)
        self.assertEqual(v['status'],'render_updates_with_input')
        self.assertFalse(v['gameplay_verified'])

    def test_no_input(self):
        self.write([[1,100,1,'0000','aa'],[2,200,2,'0000','ab']])
        self.assertEqual(mod.audit(self.file)['status'],'render_updates_no_input')

    def test_window_not_reached(self):
        self.write([[1,100,1,'0000','aa']])
        self.assertEqual(mod.audit(self.file,start=10)['status'],'no_samples_after_start')

    def test_frame_duplicate_rejected(self):
        self.write([[1,100,1,'0000','aa'],[1,200,2,'0000','ab']])
        with self.assertRaises(ValueError):mod.audit(self.file)

    def test_counter_regression_rejected(self):
        self.write([[1,100,5,'0000','aa'],[2,200,4,'0000','ab']])
        with self.assertRaises(ValueError):mod.audit(self.file)

    def test_video_restricted_to_progress_window(self):
        self.write([[1,100,1,'8100','aa'],[2,200,2,'8100','aa']])
        path=Path(self.d.name)/'video.csv'
        cols=['frame','pc','framebuffer','wram','vram','cgram','oam',
              'ppu_writes','dma_bytes','hdma_bytes','blocked_vram_writes',
              'inidisp','bgmode','tm','ts','joy1','autojoy1']
        with path.open('w',newline='') as f:
            w=csv.writer(f);w.writerow(cols)
            for frame in range(1,4):
                w.writerow([frame,'c00000','aa' if frame<3 else 'bb',str(frame),
                            'aa','aa','aa',frame,frame,frame,0,15,0,17,0,0,0])
        result=mod.audit(self.file,video=path)
        self.assertEqual(result['observations']['video_state']['samples'],2)
        self.assertEqual(result['observations']['video_state']['status'],
                         'static_image_wram_changed_video_memory_static')

    def test_bad_hash_rejected(self):
        self.write([[1,100,5,'0000','gg']])
        with self.assertRaises(ValueError):mod.audit(self.file)

    def test_missing_columns_rejected(self):
        self.file.write_text('frame,foo\n1,bar\n')
        with self.assertRaises(ValueError):mod.audit(self.file)

if __name__=='__main__':unittest.main()
