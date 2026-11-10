#!/usr/bin/env python3
"""Read-only, ROM-independent audit of two crossfed runtime fixes.

This is a source contract check, *not* replay proof or full hardware equivalence.
"""
import argparse,hashlib,json,re
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--zero',type=Path,required=True,help='DKC3 ZERO source root')
p.add_argument('--report',type=Path)
a=p.parse_args()
root=Path(__file__).resolve().parents[1]
generator=(root/'forja65-core.js').read_text(encoding='utf-8')
zero_path=a.zero/'src/runtime.hpp'
zero=zero_path.read_text(encoding='utf-8')
features={
 'cpu_decimal_branch': ('if(!decimalMode){c=raw>mask;' in generator and 'if(!decimalMode){c=raw>mask;' in zero),
 'cpu_decimal_bcd_adder': ('for(int shift=0;shift<w;shift+=4)' in generator and 'for(int shift=0;shift<w;shift+=4)' in zero),
 'cpu_decimal_bcd_subtractor': ('if(digit<0)digit-=6' in generator and 'if(digit<0)digit-=6' in zero),
 'spc_dspaddr_bit7_write_inhibit': ('if(s.spc.dspAddr&0x80u)return;' in generator and 'if(spc.dspAddr&0x80u)return;' in zero),
}
report={'schema':'forja65.zero.runtime.crossfeed.v1','source_only':True,
 'rom_independent':True,'replay_verified':False,'features':features,
 'generator_sha256':hashlib.sha256(generator.encode()).hexdigest(),
 'zero_runtime_sha256':hashlib.sha256(zero.encode()).hexdigest()}
if a.report:a.report.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
if not all(features.values()):raise SystemExit(2)
