import unittest
from verify_fork_multi_rev148 import parse_sequence
class TestParse(unittest.TestCase):
 def test_good(self):self.assertEqual(parse_sequence('4:0x8000,6:0,2:0x2100'),[(4,32768),(6,0),(2,8448)])
 def test_zero(self):
  with self.assertRaises(ValueError):parse_sequence('0:0')
 def test_mask(self):
  with self.assertRaises(ValueError):parse_sequence('4:0x10000')
 def test_format(self):
  with self.assertRaises(ValueError):parse_sequence('4:0,5')
 def test_empty(self):
  with self.assertRaises(ValueError):parse_sequence('')
if __name__=='__main__':unittest.main()
