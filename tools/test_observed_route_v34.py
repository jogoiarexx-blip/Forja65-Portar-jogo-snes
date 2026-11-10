#!/usr/bin/env python3
"""v0.34: real observed ROM route and multipart state provenance."""
import importlib.util
import json
import re
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'analysis' / 'soldiers-crossfeed-v34'
spec = importlib.util.spec_from_file_location('integrator_v34', ROOT / 'tools' / 'integrate-observed-flow.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class RealObservedRoutes(unittest.TestCase):
    def test_real_rom_observation(self):
        for routine, caller, count in [('C09CD7', 'C0CB8C', 42), ('C09D67', 'C09D34', 315), ('C0AD9E', 'C0A1BD', 33), ('C0C860', 'C0C801', 7)]:
            with self.subTest(routine=routine):
                proof = json.loads((BASE / (routine + '-proof.json')).read_text())
                self.assertEqual(proof['rom'], '2f095d162726b5ea')
                self.assertEqual(proof['routine'], routine)
                self.assertEqual(proof['variants'], 2)
                self.assertTrue(any(e['target'] == int(routine,16) and e['from'] == int(caller,16) and e['kind']=='FLOW' for e in proof['observed']))
                self.assertEqual(len({pc for d in proof['decoded'] for pc in d['pcs']}),count)

    def test_multipart_variants_not_counted_as_states(self):
        # Six C++ chunks for two real CPU states, with complete part sequences.
        proof=BASE/'C09D67-proof.json'
        pcs={pc for item in json.loads(proof.read_text())['decoded'] for pc in item['pcs']}
        pieces=[(f'sub_C09D67_E0M0X0C0_part{i}', '') for i in range(4)]
        pieces += [(f'sub_C09D67_E0M0X0CQ_part{i}', '') for i in range(2)]
        mod.validate_proof(proof, 'C09D67', pieces, pcs, '2f095d162726b5ea')
        with self.assertRaisesRegex(ValueError,'incomplete multipart'):
            mod.validate_proof(proof,'C09D67',[p for p in pieces if not p[0].endswith('C0_part1')],pcs,'2f095d162726b5ea')
        with self.assertRaisesRegex(ValueError,'fingerprint'):
            mod.validate_proof(proof,'C09D67',pieces,pcs,'0000000000000000')

    def test_existing_unsplit_variant_still_accepted(self):
        proof=BASE/'C09CD7-proof.json'
        pcs={pc for item in json.loads(proof.read_text())['decoded'] for pc in item['pcs']}
        mod.validate_proof(proof,'C09CD7', [('sub_C09CD7_E0M0X0C0',''),('sub_C09CD7_E0M0X0CQ','')],pcs,'2f095d162726b5ea')

if __name__=='__main__':unittest.main()
