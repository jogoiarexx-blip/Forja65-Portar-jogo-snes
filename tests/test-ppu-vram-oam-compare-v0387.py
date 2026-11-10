#!/usr/bin/env python3
import importlib.util, tempfile, unittest
from pathlib import Path
name=Path(__file__).resolve().parents[1]/'ppu-vram-oam-compare.py'
spec=importlib.util.spec_from_file_location('ppu_diff',str(name));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class TestCompare(unittest.TestCase):
 def test_diff_and_missing(self):
  with tempfile.TemporaryDirectory() as t:
   a,b=Path(t)/'a',Path(t)/'b';a.mkdir();b.mkdir()
   for n,s in m.SIZES.items():
    z=bytearray(s);a.joinpath(n).write_bytes(z);b.joinpath(n).write_bytes(z)
   same=m.compare(a,b);self.assertTrue(same['comparison_complete'])
   self.assertTrue(all(x['status']=='same' for x in same['memory'].values()))
   c=bytearray((b/'oam.bin').read_bytes());c[0]=5;c[512]=2;(b/'oam.bin').write_bytes(c)
   v=bytearray((b/'vram.bin').read_bytes());v[0x2000]=1;(b/'vram.bin').write_bytes(v)
   g=bytearray((b/'cgram.bin').read_bytes());g[259]=2;(b/'cgram.bin').write_bytes(g)
   diff=m.compare(a,b)
   self.assertEqual(diff['memory']['oam.bin']['different_bytes'],2)
   self.assertEqual(diff['oam_changed_slots'][0]['candidate']['x'],5)
   self.assertEqual(diff['oam_changed_slots'][0]['candidate']['large'],True)
   self.assertEqual(diff['memory']['vram.bin']['changed_8kb_banks'],[1])
   self.assertIn(129,diff['memory']['cgram.bin']['affected_colors'])
   (b/'cgram.bin').unlink();self.assertFalse(m.compare(a,b)['comparison_complete'])
 def test_invalid_size(self):
  with tempfile.TemporaryDirectory() as t:
   a,b=Path(t)/'a',Path(t)/'b';a.mkdir();b.mkdir()
   for n,s in m.SIZES.items():a.joinpath(n).write_bytes(bytes(s));b.joinpath(n).write_bytes(bytes(s))
   (b/'vram.bin').write_bytes(b'no')
   self.assertEqual(m.compare(a,b)['memory']['vram.bin']['status'],'invalid_size')
if __name__=='__main__':unittest.main()
