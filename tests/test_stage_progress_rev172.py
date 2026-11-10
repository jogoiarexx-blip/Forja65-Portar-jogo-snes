import importlib.util, pathlib, unittest
m=pathlib.Path(__file__).resolve().parents[1]/'tools/audit-stage-progress-rev172.py'
spec=importlib.util.spec_from_file_location('stage',m);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
def row(i,x,y,joy='0100'):
 return {'frame':str(i),'wram_009dd_2':str(x),'wram_009e0_2':str(y),'joy1':joy,'wram_009da_1':'18'}
class Tests(unittest.TestCase):
 def test_no_false_victory_when_stuck(self):
  rows=[row(i,400+i if i<5 else 405,590) for i in range(120)]
  x=mod.analyze(rows,'wram_009dd_2','wram_009e0_2',20)
  self.assertEqual(x['phase_clear'],'NOT_VERIFIED')
  self.assertEqual(x['max_x'],405)
  self.assertTrue(x['stalls_right'])
 def test_detect_reset_not_infinite_x(self):
  rows=[row(i,400+i,620) for i in range(20)]+[row(20,0,0),row(21,400,620)]
  x=mod.analyze(rows,'wram_009dd_2','wram_009e0_2',10)
  self.assertTrue(x['suspected_resets'])
  self.assertEqual(x['phase_clear'],'NOT_VERIFIED')
 def test_invalid_trace(self):
  with self.assertRaises(ValueError):mod.analyze([row(2,4,6),row(2,5,6)],'wram_009dd_2','wram_009e0_2')
if __name__=='__main__':unittest.main()
