import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from rom_pack_gate_rev157 import make_pack, inspect_pack, HEADER, REGION


class PackGateTests(unittest.TestCase):
    def setUp(self):
        self.rom = bytes(range(256)) * 4
        self.pack = make_pack(self.rom)

    def test_roundtrip(self):
        meta = inspect_pack(self.pack, self.rom)
        self.assertEqual(meta['covered'], 1024)
        self.assertEqual(meta['regions'], 1)

    def test_truncated(self):
        with self.assertRaises(ValueError): inspect_pack(self.pack[:-1], self.rom)

    def test_wrong_rom(self):
        with self.assertRaises(ValueError): inspect_pack(self.pack, self.rom[:-1] + b'X')

    def test_modified_data(self):
        broken = bytearray(self.pack); broken[-1] ^= 1
        with self.assertRaises(ValueError): inspect_pack(bytes(broken), self.rom)

    def test_wrong_magic(self):
        with self.assertRaises(ValueError): inspect_pack(b'XXXX' + self.pack[4:], self.rom)

    def test_trailing_bytes(self):
        with self.assertRaises(ValueError): inspect_pack(self.pack + b'bad', self.rom)

    def test_partial(self):
        short = self.rom[:100]
        pack = HEADER.pack(b'F65R', 1, len(self.rom), __import__('rom_pack_gate_rev157').fnv64(self.rom), 1) + REGION.pack(0,100) + short
        with self.assertRaises(ValueError): inspect_pack(pack, self.rom)
        self.assertEqual(inspect_pack(pack, self.rom, require_full=False)['covered'],100)

    def test_out_of_bounds(self):
        data = bytearray(self.pack)
        REGION.pack_into(data, HEADER.size, 999, 1024)
        with self.assertRaises(ValueError): inspect_pack(bytes(data),self.rom)


if __name__ == '__main__': unittest.main()
