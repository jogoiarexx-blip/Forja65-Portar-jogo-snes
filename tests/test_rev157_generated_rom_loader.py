"""Compile the actual NativeRomStore emitted by Forja and fuzz basic malformed packs."""
import struct
import subprocess
import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'tools'))
from rom_pack_gate_rev157 import make_pack

ROOT = Path(__file__).resolve().parents[1]

class GeneratedCppLoadTests(unittest.TestCase):
    def test_generated_cpp_load_rejects_corruption(self):
        core = (ROOT / 'forja65-core.js').read_text()
        start = core.index('struct NativeRomRegion {')
        end = core.index('enum class CartChip {', start)
        fragment = core[start:end]
        self.assertIn('struct NativeRomStore', fragment)
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            src = td / 'test.cpp'
            src.write_text('''#include <cstdint>\n#include <fstream>\n#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n#include <utility>\n''' + fragment + '''\nint main(int argc, char** argv) { NativeRomStore s; bool ok=s.load(argv[1]); if(ok){std::uint8_t v=0;if(!s.read(23,v)||v!=23)return 3;}std::cout<<(ok?"OK":"NO")<<"\\n";return 0;}''')
            exe = td / 'verify'
            subprocess.run(['g++', '-std=c++17', '-O0', str(src), '-o', str(exe)], check=True, capture_output=True, text=True)
            rom = bytes(range(256))
            good = make_pack(rom)
            wrong = bytearray(good);wrong[24:32]=struct.pack('<II',255,256)
            cases = [('good', good, True),('truncated',good[:-4],False),
                     ('trailing',good+b'A',False),('overflow',bytes(wrong),False),
                     ('short-header',b'F65R',False)]
            for name, contents, expected in cases:
                with self.subTest(name=name):
                    file = td / (name+'.bin');file.write_bytes(contents)
                    proc = subprocess.run([str(exe),str(file)],check=True,capture_output=True,text=True)
                    self.assertEqual(proc.stdout.strip()=='OK',expected)

if __name__=='__main__': unittest.main()
