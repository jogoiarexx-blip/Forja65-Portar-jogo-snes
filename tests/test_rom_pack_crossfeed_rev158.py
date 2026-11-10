import sys,struct,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from rom_pack_gate_rev157 import inspect_pack, make_pack, fnv64, HEADER, REGION
class CrossfeedPackTests(unittest.TestCase):
 def setUp(self): self.rom=bytes(range(256))*4
 def v2(self):
  body=REGION.pack(0,len(self.rom))+self.rom
  return HEADER.pack(b'F65R',2,len(self.rom),fnv64(self.rom),1)+body+struct.pack('<Q',fnv64(body))
 def test_v2_from_r4_builder_is_accepted(self): self.assertEqual(inspect_pack(self.v2(),self.rom)['covered'],len(self.rom))
 def test_v2_integrity_without_trusted_rom(self):
  raw=bytearray(self.v2());raw[50]^=1
  with self.assertRaises(ValueError):inspect_pack(raw)
 def test_v1_compatibility(self): self.assertEqual(inspect_pack(make_pack(self.rom),self.rom)['version'],1)
 def test_empty_sparse_pack_rejected(self):
  raw=HEADER.pack(b'F65R',1,1024,fnv64(self.rom),0)
  with self.assertRaises(ValueError):inspect_pack(raw,require_full=False)
 def test_runtime_size_limit(self):
  raw=HEADER.pack(b'F65R',1,128*1024*1024+1,0,1)+REGION.pack(0,1)+b'a'
  with self.assertRaises(ValueError):inspect_pack(raw,require_full=False)
if __name__=='__main__':unittest.main()
