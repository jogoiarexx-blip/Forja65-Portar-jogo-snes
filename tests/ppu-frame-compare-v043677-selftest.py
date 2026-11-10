"""Unit test the image decoder, format pairing, error modes, and pixel metrics."""
import importlib.util
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

TOOL = Path(__file__).resolve().parents[1]/'tools'/'ppu-frame-compare-v043677.py'
spec=importlib.util.spec_from_file_location('ppu_diff', TOOL)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def chunk(kind,payload):
    return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)


def png(w,h,ctype,rows,extra=b''):
    d=mod.PNG_SIGNATURE
    d+=chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,ctype,0,0,0))
    d+=extra+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
    return d


class FrameCompare(unittest.TestCase):
    def test_ppm_comment_and_newline_payload(self):
        color=b'\n\r\t'  # PPM payload starts with whitespace; must not be skipped.
        self.assertEqual(mod.read_ppm(b'P6\n#hello\n1 1\n255\n'+color),(1,1,color))

    def test_png_rgb_filters(self):
        # Two 2-pixel rows, the second row is encoded with UP filtering.
        row=bytes([100,20,30,4,5,6])
        d=png(2,2,2,[b'\x00'+row,b'\x02'+bytes((v*0)&255 for v in row)])
        w,h,rgb=mod.read_png(d)
        self.assertEqual((w,h),(2,2))
        self.assertEqual(rgb,row*2)

    def test_png_rgba_alpha_to_black(self):
        d=png(2,1,6,[b'\x00'+bytes([100,50,20,255,100,50,20,0])])
        self.assertEqual(mod.read_png(d)[2], bytes([100,50,20,0,0,0]))

    def test_png_palette_transparent_and_paeth(self):
        extra=chunk(b'PLTE',bytes([10,20,30,40,50,60]))+chunk(b'tRNS',bytes([255,0]))
        d=png(2,1,3,[b'\x04\x00\x01'],extra)
        self.assertEqual(mod.read_png(d)[2],bytes([10,20,30,0,0,0]))

    def test_png_reject_corrupt_crc(self):
        d=bytearray(png(1,1,2,[b'\x00\x01\x02\x03']))
        d[-5]^=0x1
        with self.assertRaisesRegex(mod.ImageError,'CRC'):
            mod.read_png(d)

    def test_roi_and_threshold(self):
        reference={'width':2,'height':2,'rgb':bytes([0,0,0]*4)}
        actual={'width':2,'height':2,'rgb':bytes([1,0,0]+[0,0,0]*3)}
        report,heat=mod.diff_pair(reference,actual,None,0,8)
        self.assertEqual(report['different_pixels'],1)
        self.assertEqual(report['bounding_box'],[0,0,0,0])
        self.assertEqual(report['mean_absolute_channel_error'],1/12 if False else 0.083333)
        self.assertEqual(len(heat),12)
        report,_=mod.diff_pair(reference,actual,None,1,8)
        self.assertEqual(report['different_pixels'],0)
        report,_=mod.diff_pair(reference,actual,'1,0,1,1',0,8)
        self.assertEqual(report['different_pixels'],0)

    def test_png_reference_ppm_actual_and_negative(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'r').mkdir();(root/'a').mkdir()
            (root/'r'/'frame001.png').write_bytes(png(1,1,2,[b'\x00\x01\x02\x03']))
            mod.save_ppm(root/'a'/'frame001.ppm',1,1,b'\x01\x02\x03')
            args=[sys.executable,str(TOOL),'--reference',str(root/'r'),'--actual',str(root/'a'),'--output-dir',str(root/'out')]
            ok=subprocess.run(args,capture_output=True,text=True)
            self.assertEqual(ok.returncode,0,ok.stderr)
            report=json.loads((root/'out'/'report.json').read_text())
            self.assertTrue(report['matched'])
            mod.save_ppm(root/'a'/'frame001.ppm',1,1,b'\x01\x02\x04')
            fail=subprocess.run(args,capture_output=True,text=True)
            self.assertEqual(fail.returncode,1,fail.stderr)
            report=json.loads((root/'out'/'report.json').read_text())
            self.assertEqual(report['total_different_pixels'],1)

    def test_reject_missing_frame(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'r').mkdir();(root/'a').mkdir()
            mod.save_ppm(root/'r'/'first.ppm',1,1,b'\0\0\0')
            with self.assertRaisesRegex(mod.ImageError,'capture sets differ'):
                mod.list_pairs(root/'r',root/'a')

    def test_reject_duplicate_stems(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'r').mkdir();(root/'a').mkdir()
            (root/'r'/'same.png').write_bytes(b'')
            (root/'r'/'same.ppm').write_bytes(b'')
            with self.assertRaisesRegex(mod.ImageError,'duplicate image stem'):
                mod.list_pairs(root/'r',root/'a')


if __name__=='__main__':
    unittest.main(verbosity=2)
