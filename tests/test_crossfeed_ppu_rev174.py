import tempfile
import unittest
from pathlib import Path
import importlib.util

SCRIPT=Path(__file__).resolve().parents[1]/'tools/crossfeed_ppu_rev174.py'
spec=importlib.util.spec_from_file_location('crossfeed_rev174',SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PpuCrossfeedTests(unittest.TestCase):
 def test_three_exact_replacements_and_idempotence(self):
  original='struct PpuState {\nLayerPixel compose(\n'+ '\n'.join(v[0] for v in module.FIXES.values())
  patched,changes=module.apply(original)
  self.assertEqual(len(changes),3)
  for bad,correct in module.FIXES.values():
   self.assertNotIn(bad,patched);self.assertIn(correct,patched)
  again,empty=module.apply(patched)
  self.assertEqual(empty,[]);self.assertEqual(patched,again)
 def test_unknown_template_fails_closed(self):
  original='struct PpuState { LayerPixel compose(\n' + '\n'.join(v[0] for v in module.FIXES.values())
  with self.assertRaisesRegex(ValueError,'Unsafe or unknown'):
   module.apply(original.replace('bgOfsByte{},m7Byte{}','bgOfsByte{},obsolete{},m7Byte{}'))
 def test_duplication_fails_closed(self):
  original='struct PpuState { LayerPixel compose(\n'+'\n'.join(v[0] for v in module.FIXES.values())
  with self.assertRaises(ValueError):module.apply(original+'\n'+module.FIXES['subscreen_backdrop'][0])
 def test_standalone_dry_run_is_pure(self):
  with tempfile.TemporaryDirectory() as d:
   file=Path(d)/'runtime.hpp'
   raw='struct PpuState { LayerPixel compose(\n'+'\n'.join(v[0] for v in module.FIXES.values())
   file.write_text(raw)
   patched,_=module.apply(file.read_text())
   self.assertEqual(file.read_text(),raw)
   self.assertNotEqual(raw,patched)

if __name__=='__main__':unittest.main()
