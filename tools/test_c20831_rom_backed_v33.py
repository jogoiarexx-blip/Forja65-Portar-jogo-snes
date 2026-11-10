#!/usr/bin/env python3
"""Structural regression of the real C2:0831 observed decoder proof."""
import json
import unittest
from pathlib import Path

PROOF = Path(__file__).resolve().parents[1] / 'analysis' / 'soldiers-crossfeed-v33' / 'C20831-proof.json'
class C20831RomEvidence(unittest.TestCase):
    def test_observed_entry_and_fingerprint(self):
        p=json.loads(PROOF.read_text())
        self.assertEqual(p['schema'],1)
        self.assertEqual(p['rom'],'2f095d162726b5ea')
        self.assertEqual(p['routine'],'C20831')
        self.assertTrue(any(o['target']==0xC20831 and o['from']==0xC04402 and o['kind']=='FLOW' and o['state']==dict(emulation=False,m8=True,x8=False,carry=True) for o in p['observed']))
    def test_native_coverage(self):
        p=json.loads(PROOF.read_text())
        self.assertEqual(p['variants'],2)
        self.assertEqual(len(p['decoded']),2)
        self.assertEqual(len({pc for v in p['decoded'] for pc in v['pcs']}),23)
        self.assertTrue(all(v['entryPc']==0xC20831 and v['decodedNative']==len(v['pcs']) for v in p['decoded']))

if __name__=='__main__':unittest.main()
