import unittest,tempfile,hashlib
from pathlib import Path
from trace_timeline_rev152 import validate_trace
from test_course_evidence_rev151 import EvidenceGate

class TraceValidation(unittest.TestCase):
    def check(self,lines,should_fail=False):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'trace.txt';p.write_text(lines)
            if should_fail:
                with self.assertRaises(ValueError):validate_trace(p,race_frame=100)
            else:return validate_trace(p,race_frame=100)
    def test_accepted(self):
        d=self.check('# trace\nframe=0 joy1=8000 joy2=0000\nframe=30 joy1=8200 joy2=0000\n')
        self.assertEqual(d['event_count'],2)
    def test_descending(self):self.check('frame=30 joy1=0000 joy2=0000\nframe=10 joy1=8000 joy2=0000\n',True)
    def test_duplicate(self):self.check('frame=30 joy1=8000 joy2=0000\nframe=30 joy1=0000 joy2=0000\n',True)
    def test_bad_mask(self):self.check('frame=30 joy1=zzzz joy2=0000\n',True)
    def test_negative(self):self.check('frame=-1 joy1=8000 joy2=0000\n',True)
    def test_missing_events(self):self.check('# only header\n',True)
    def test_after_finish(self):self.check('frame=101 joy1=8000 joy2=0000\n',True)
    def test_text(self):self.check('frame=1 joy1=0000 joy2=0000\nunknown command\n',True)
    def test_manifest_rejects_even_if_rehashed(self):
        c=EvidenceGate('test_evidence_chain_ok');c.setUp()
        try:
            p=c.root/'race.trace';p.write_text('frame=40 joy1=8000 joy2=0000\nframe=35 joy1=8000 joy2=0000\n')
            c.data['input_trace']['sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
            from course_evidence_rev151 import check
            d=check(c.data,c.root)
            self.assertEqual(d['status'],'INVALID_EVIDENCE')
            self.assertIn('out-of-order',d['detail'])
        finally:c.tearDown()
if __name__=='__main__':unittest.main()
