import importlib.util
import tempfile
import unittest
from pathlib import Path

P = Path(__file__).with_name('native-bus-trace-v043628.py')
spec = importlib.util.spec_from_file_location('native_bus', P)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class NativeTraceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'native.csv'
        self.target = Path(self.temp.name) / 'bus.csv'
    def write(self, lines):
        self.source.write_text('# FORJA_TRACE 1 rom=test\nseq,frame,routine,pc,kind,space,address,value,source\n'+lines+'# written=3 dropped=0\n')
    def test_filters_and_reindexes(self):
        self.write('0,0,0,32768,instruction,CPU,32768,169,CPU\n1,0,0,32768,read,ROM,32768,42,CPU\n2,0,0,32768,write,WRAM,12648448,42,CPU\n')
        result = module.convert(self.source, self.target)
        self.assertEqual(result['bus_events'], 2)
        self.assertIn('0,32768,read,42', self.target.read_text())
        self.assertIn('1,12648448,write,42', self.target.read_text())
        self.assertFalse(result['clock_accuracy'])
    def test_rejects_nonmonotonic(self):
        self.write('1,0,0,0,read,ROM,0,1,CPU\n1,0,0,0,read,ROM,0,1,CPU\n')
        with self.assertRaises(ValueError): module.convert(self.source, self.target)
    def test_rejects_invalid_byte(self):
        self.write('0,0,0,0,write,WRAM,0,300,CPU\n')
        with self.assertRaises(ValueError): module.convert(self.source, self.target)
    def test_excludes_dma_by_default(self):
        self.write('0,0,0,0,read,ROM,0,1,DMA\n1,0,0,0,read,ROM,0,2,CPU\n')
        self.assertEqual(module.convert(self.source, self.target)['bus_events'], 1)
        self.assertEqual(module.convert(self.source, self.target, ('CPU','DMA'))['bus_events'], 2)
    def test_rejects_missing_header(self):
        self.source.write_text('a,b\n1,2\n')
        with self.assertRaises(ValueError): module.convert(self.source, self.target)

if __name__ == '__main__': unittest.main()
