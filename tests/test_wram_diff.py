import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

p=Path(__file__).resolve().parent.parent / 'tools' / 'wram-diff-analyze.py'
s=importlib.util.spec_from_file_location('watch',p)
w=importlib.util.module_from_spec(s)
s.loader.exec_module(w)

class TestWramDiff(unittest.TestCase):
    def make(self, root, name, events, truncate=False):
        f=root/name
        with f.open('w',newline='') as io:
            writer=csv.writer(io)
            writer.writerow(['kind','frame','wram_address','old_value','new_value','changed','emitted','truncated','joy1','nmi','pc'])
            writer.writerow(['baseline',0,'','','',0,0,0,0,0,0])
            writer.writerow(['summary',1,'','','',0,0,0,0,0,0])
            for adr,old,new in events:
                writer.writerow(['delta',2,adr,old,new,1,1,0,32768 if name=='input.csv' else 0,2,0])
            writer.writerow(['summary',2,'','','',len(events)+(1 if truncate else 0),len(events),int(truncate),32768 if name=='input.csv' else 0,2,0])
        return f
    def test_detects_differential_address(self):
        with tempfile.TemporaryDirectory() as td:
            t=Path(td)
            a=w.read_log(self.make(t,'neutral.csv', [('7E0001',0,1)]))
            b=w.read_log(self.make(t,'input.csv', [('7E0002',0,2)]))
            r=w.analyze(a,b)
            self.assertEqual(r['first_divergent_input_frame'],2)
            self.assertEqual({x['snes_address'] for x in r['candidates']},{'$7E0001','$7E0002'})
    def test_truncation_prevents_absence_claims(self):
        with tempfile.TemporaryDirectory() as td:
            t=Path(td)
            a=w.read_log(self.make(t,'neutral.csv',[],truncate=True))
            b=w.read_log(self.make(t,'input.csv',[]))
            self.assertTrue(w.analyze(a,b)['insufficient_evidence'])
    def test_rejects_invalid_address(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(ValueError):
                w.read_log(self.make(Path(td),'neutral.csv',[('7DFFFF',0,1)]))
    def test_requires_divergent_input(self):
        with tempfile.TemporaryDirectory() as td:
            t=Path(td)
            a=w.read_log(self.make(t,'neutral.csv',[]))
            with self.assertRaisesRegex(ValueError,'No control divergence'):
                w.analyze(a,a)
    def test_rejects_nonidentical_prefix(self):
        with tempfile.TemporaryDirectory() as td:
            t=Path(td)
            p1=self.make(t,'neutral.csv',[]);p2=self.make(t,'input.csv',[])
            text=p2.read_text().replace('summary,1,,,,0,0,0,0','summary,1,,,,1,1,0,0')
            p2.write_text(text)
            with self.assertRaises(ValueError):w.read_log(p2)
    def test_empty_log_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'file.csv';p.write_text('kind,frame,wram_address,old_value,new_value,changed,emitted,truncated,joy1\n')
            with self.assertRaises(ValueError):w.read_log(p)

    def test_duplicate_snapshot_address_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            p=self.make(Path(td),'neutral.csv',[('7E0001',0,1),('7E0001',1,2)])
            with self.assertRaises(ValueError):w.read_log(p)

if __name__=='__main__':unittest.main()

