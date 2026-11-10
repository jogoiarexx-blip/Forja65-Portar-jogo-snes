import unittest
from route_alias_audit_rev152 import detect
class RouteAlias(unittest.TestCase):
 def test_alias(self):
  route=[(i*100,0) for i in range(40)]
  route[37]=(300,2)
  r=detect(route,list(range(40)),distance_limit=5,sample_separation=5)
  self.assertEqual(r['status'],'AMBIGUOUS_ROUTE')
  self.assertGreaterEqual(r['ambiguous_pairs'],1)
 def test_no_false_alias(self):
  route=[(i*100,0) for i in range(40)]
  self.assertEqual(detect(route,list(range(40)),distance_limit=5)['ambiguous_pairs'],0)
 def test_malformed(self):
  with self.assertRaises(ValueError):detect([(1,2)]*40,[2]*20)
if __name__=='__main__':unittest.main()
