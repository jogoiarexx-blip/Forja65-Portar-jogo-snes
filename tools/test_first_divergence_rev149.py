import unittest
from first_divergence_rev149 import clipped,mask_at,same_length
class TestFirstDivergenceRev149(unittest.TestCase):
 def test_clipping_boundary(self):
  a=[(4,0x8000),(5,0x8100),(3,0)]
  self.assertEqual(clipped(a,0),[])
  self.assertEqual(clipped(a,4),[(4,0x8000)])
  self.assertEqual(clipped(a,7),[(4,0x8000),(3,0x8100)])
  self.assertEqual(clipped(a,12),a)
 def test_reject_length(self):
  with self.assertRaises(ValueError):clipped([(5,0)],6)
  with self.assertRaises(ValueError):clipped([(5,0)],-1)
 def test_mask(self):
  self.assertEqual(mask_at([(2,1),(3,2)],2),2)
  with self.assertRaises(IndexError):mask_at([(2,1)],2)
 def test_length(self):
  self.assertTrue(same_length([(2,1),(3,2)],[(5,3)]))
  self.assertFalse(same_length([(2,1)],[(3,1)]))
if __name__=='__main__':unittest.main()
