#!/usr/bin/env python3
"""DKC3 real ROM trace + adversarial checks of dynamic DP jump evidence."""
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
PROJECT=Path(sys.argv[1])
ROM=(PROJECT/'assets/cart-data.bin').read_bytes()
D=PROJECT/'diagnosticos-v04246/v04246-updated'
TRACE=(D/'forja65-crash-trace.txt').read_text()
HINTS=(D/'forja65-runtime-hints.txt').read_text()
ERROR=(D/'forja65-last-error.txt').read_text()
spec=importlib.util.spec_from_file_location('dp_audit',ROOT/'tools/audit-dp-indirect-frontier.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=m.audit(ROM,TRACE,HINTS,ERROR,0xB9A149,0xB9AAEE)
assert p['pointer_absolute']=='0042' and p['written_value']=='AAEE'
assert p['store_site']=='B9A144' and p['pea_site']=='B9A146'
assert p['return_word']=='A14B' and p['stack_before']=='01F4' and p['stack_after']=='01F2'
print('POSITIVE: HiROM/DP STA16/PEA/JMP, ROM-bound hint and terminal CPU trace')
changes=[
('wrong rom opcode',bytes(ROM[:0x39a149])+b'\xea'+ROM[0x39a14a:],TRACE,HINTS,ERROR),
('wrong STA opcode',bytes(ROM[:0x39a144])+b'\x86'+ROM[0x39a145:],TRACE,HINTS,ERROR),
('wrong return word',bytes(ROM[:0x39a147])+b'\x4c'+ROM[0x39a148:],TRACE,HINTS,ERROR),
('wrong hint fingerprint',ROM,TRACE,HINTS.replace('rom=3a574807afbad761','rom=deadbeefdeadbeef'),ERROR),
('wrong error destination',ROM,TRACE,HINTS,ERROR.replace('12167918','12167919')),
('stale last trace',ROM,TRACE+'\nb9a14c A=aaee X=878 Y=14d5 S=1f2 D=0 DB=b9 PB=b9 P=85 E=0 M=0 X8=0 C=1\n',HINTS,ERROR),
('different accumulator',ROM,TRACE.replace('b9a144 A=aaee','b9a144 A=aacc'),HINTS,ERROR),
('different DP',ROM,TRACE.replace('b9a149 A=aaee X=878 Y=14d5 S=1f2 D=0','b9a149 A=aaee X=878 Y=14d5 S=1f2 D=1'),HINTS,ERROR),
('different stack',ROM,TRACE.replace('b9a149 A=aaee X=878 Y=14d5 S=1f2','b9a149 A=aaee X=878 Y=14d5 S=1f3'),HINTS,ERROR),
('different M flag',ROM,TRACE.replace('b9a149 A=aaee X=878 Y=14d5 S=1f2 D=0 DB=b9 PB=b9 P=85 E=0 M=0','b9a149 A=aaee X=878 Y=14d5 S=1f2 D=0 DB=b9 PB=b9 P=85 E=0 M=1'),HINTS,ERROR),
]
for name,r,t,h,e in changes:
    try:m.audit(r,t,h,e,0xB9A149,0xB9AAEE)
    except ValueError: pass
    else:raise AssertionError('Forged proof accepted: '+name)
print(f'NEGATIVE: {len(changes)} adulterations rejected')
with tempfile.TemporaryDirectory() as td:
    td=Path(td)
    for name,updates in [('wrong destination',{'target':'B9AAEF'}),('wrong return',{'return_word':'A14C'}),('wrong RAM vector',{'pointer_absolute':'0044'}),('wrong ROM hash',{'rom_sha256':'0'*64})]:
        fake={**p,**updates}
        proof=td/(name.replace(' ','_')+'.json');proof.write_text(json.dumps(fake))
        cmd=['node',str(ROOT/'tools/generate-observed-flow.js'),str(PROJECT/'assets/cart-data.bin'),
             str(D/'forja65-runtime-hints.txt'),'B9AAEE',str(td/'generated'),
             '--verified-target','--dp-jmp-proof',str(proof)]
        r=subprocess.run(cmd,capture_output=True,text=True)
        assert r.returncode!=0,(name,r.stdout,r.stderr)
print('EMITTER: 4 forged JSON proofs rejected')
