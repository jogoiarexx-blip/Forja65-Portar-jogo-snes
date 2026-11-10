#!/usr/bin/env python3
"""Reusable dispatch state gap classifier: reject wrong ROM and false coverage."""
from pathlib import Path
from importlib.machinery import SourceFileLoader
import tempfile, json
root=Path(__file__).resolve().parents[1]
mod=SourceFileLoader('state_audit',str(root/'tools/audit-observed-state-variants.py')).load_module()
assert mod.fingerprint(b'forja65')==mod.fingerprint(b'forja65')
with tempfile.TemporaryDirectory() as directory:
    d=Path(directory);rom=d/'rom.bin';rom.write_bytes(b'abcd')
    fingerprint=mod.fingerprint(b'abcd')
    hint=d/'hint.txt';hint.write_text(f'rom={fingerprint} target=ca45 from=fffff5 kind=STATE e=0 m=0 x=0 c=0\n')
    dispatch=d/'dispatch.cpp'
    dispatch.write_text('{0x00CA45u,false,true,false,false,false,&sub_00CA45_E0M1X0CQ,0x00CA45u},\n')
    result=mod.audit(rom,dispatch,hint)
    assert result['status']=='variant_missing' and result['dispatcher_entry_count']==1
    assert result['variants'][0]['m']==1 and not result['variants'][0]['compatible']
    dispatch.write_text('{0x00CA45u,false,false,false,false,false,&sub_00CA45_E0M0X0CQ,0x00CA45u},\n')
    assert mod.audit(rom,dispatch,hint)['status']=='covered'
    dispatch.write_text('')
    assert mod.audit(rom,dispatch,hint)['status']=='entry_missing'
    rom.write_bytes(b'wrong')
    try:mod.audit(rom,dispatch,hint)
    except ValueError as e:assert 'different ROM' in str(e)
    else:raise AssertionError('wrong ROM was accepted')
report=json.loads((root/'reports/validation-crossfeed-0396/b9ab24-applied/next-00ca45-state-audit.json').read_text())
assert report['status']=='variant_missing' and report['target']=='00CA45'
assert report['origin']=='FFFFF5' and report['required_state']=={'e':0,'m':0,'x':0,'c':0}
assert report['dispatcher_entry_count']==2 and all(v['m']==1 for v in report['variants'])
assert not report['semantics_proven']
print('PASS generic state-variant audit: covered / entry missing / width missing / ROM mismatch')
