import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from cpu_fallback_hotspots_rev154 import parse_interpreter,parse_dispatch,build_report

class HotspotTests(unittest.TestCase):
    sample='FORJA65_CPU_INTERPRETER 1\nblocks=4\ninstructions=17\n# header\n80CA64 M0X0 from=80C202 count=3\n80CA64 M0X0 from=80C213 count=1\n809EE2 M0X0 from=809ECA count=1\n'
    source='{0x80CA64u,false,false,false,false,false,&sub_80CA64_E0M0X0CQ_r154,0x80CA64u},\n'
    def test_aggregate(self):
        x=build_report(parse_interpreter(self.sample),parse_dispatch(self.source),{'instructions':'100','frames':'2'})
        self.assertEqual(x['hotspots'][0]['dispatches'],4)
        self.assertEqual(x['hotspots'][0]['entry_sources'],2)
        self.assertEqual(x['hotspots'][0]['native_exact_state'],'exact_native_state')
        self.assertEqual(x['native_share_percent'],83)
        self.assertEqual(x['fallback_dispatches_reported'],5)
    def test_invalid_row(self):
        with self.assertRaises(ValueError): parse_interpreter(self.sample+'invalid data\n')
    def test_invalid_total(self):
        with self.assertRaises(ValueError):build_report(parse_interpreter(self.sample),{}, {'instructions':'10'})
    def test_missing_variant(self):
        x=build_report(parse_interpreter(self.sample),parse_dispatch(self.source))
        self.assertEqual(x['hotspots'][1]['native_exact_state'],'no_exact_pc_or_possible_alias')
if __name__=='__main__':unittest.main()
