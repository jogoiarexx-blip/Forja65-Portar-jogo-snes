import importlib.util
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('bus',Path(__file__).with_name('compare-bus-traces-v043627.py'))
bus=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bus)

class BusTraceTests(unittest.TestCase):
    def test_identical(self):
        a=[{'cycle':1,'address':0x2180,'operation':'write','value':1}]
        self.assertTrue(bus.compare(a,a)['match'])
    def test_order_matters(self):
        a=[{'cycle':1,'address':0x2181,'operation':'write','value':0},{'cycle':2,'address':0x2180,'operation':'write','value':1}]
        self.assertEqual(bus.compare(a,list(reversed(a)))['first_divergence'],0)
    def test_missing_event(self):
        self.assertEqual(bus.compare([{'cycle':1}],[])['first_divergence'],0)
    def test_csv_aliases(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'trace.csv'
            p.write_text('tick,addr,rw,data\n1,0x2180,W,0x01\n',encoding='utf-8')
            self.assertEqual(bus.read_trace(p),[{'cycle':1,'address':0x2180,'operation':'write','value':1}])
    def test_bad_header(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'bad.csv';p.write_text('foo,bar\n1,2\n')
            with self.assertRaises(ValueError): bus.read_trace(p)
if __name__=='__main__':unittest.main()
