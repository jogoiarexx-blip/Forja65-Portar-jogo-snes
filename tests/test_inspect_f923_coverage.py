import importlib.util,tempfile,unittest
from pathlib import Path
M=Path(__file__).resolve().parents[1]/'tools'/'inspect-f923-coverage.py'
spec=importlib.util.spec_from_file_location('coverage_f923',M);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class TestF923(unittest.TestCase):
 def test_positive(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'src';p.mkdir();(p/'dispatch.cpp').write_text('case 0xC0F923: break;\n')
   self.assertEqual(mod.inspect(d)['explicit_reference_count'],1)
 def test_negative_and_substring(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'src';p.mkdir();(p/'dispatch.cpp').write_text('0xAC0F9235\n')
   self.assertEqual(mod.inspect(d)['explicit_reference_count'],0)
 def test_invalid(self):
  with self.assertRaises(ValueError): mod.inspect('.', 'hello')
if __name__=='__main__':unittest.main()
