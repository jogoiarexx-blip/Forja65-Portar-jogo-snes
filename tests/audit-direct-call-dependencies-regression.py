#!/usr/bin/env python3
"""Direct-call static auditor regression (HiROM / LoROM / unknown / bounds)."""
import importlib.util
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'tools/audit-direct-call-dependencies.py'
spec=importlib.util.spec_from_file_location('audit',p)
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
rom=bytearray(0x400000)
entry=0xBBAB29
rom[audit.offset_of(entry,'hirom'):audit.offset_of(entry,'hirom')+4]=bytes.fromhex('20 2D AB 6B')
dispatch='{0xBBAB29u,false,false,false,false,false,&abc,0xBBAB29u},\n{0xBBAB2Du,false,false,false,false,false,&xyz,0xBBAB2Du},\n{0xBBAB2Cu,false,false,false,false,false,&abc,0xBBAB29u},\n'
x=audit.audit(rom,dispatch,entry)
assert (x['direct_target'],x['continuation'],x['target_in_dispatcher'],x['continuation_in_dispatcher'])==('BBAB2D','BBAB2C',True,True)
rom[audit.offset_of(entry,'hirom')]=0xEA
assert audit.audit(rom,dispatch,entry)['status']=='not_direct_call'
lo=bytearray(0x400000)
lo[audit.offset_of(0x808000,'lorom'):audit.offset_of(0x808000,'lorom')+4]=bytes.fromhex('22 29 AB BB')
x=audit.audit(lo,dispatch,0x808000,'lorom')
assert x['instruction']=='JSL' and x['direct_target']=='BBAB29'
try: audit.offset_of(0x807000,'lorom')
except ValueError: pass
else: raise AssertionError('Missing LoROM address guard')
print('PASS static direct-call dependency audit: HiROM JSR, LoROM JSL, dispatcher and guards')
