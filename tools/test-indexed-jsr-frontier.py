#!/usr/bin/env python3
"""Real DKC3 trace and adversarial negatives; cannot certify game runtime."""
from pathlib import Path
import importlib.util, subprocess, json

ROOT=Path(__file__).resolve().parent.parent
project=Path(__import__('sys').argv[1])
diag=project/'diagnosticos-v04245/replay-after-indexed'
raw=(project/'assets/cart-data.bin').read_bytes()
spec=importlib.util.spec_from_file_location('indexed_jsr',ROOT/'tools/audit-indexed-jsr-trace.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
trace=(diag/'forja65-crash-trace.txt').read_text()
hints=(diag/'forja65-runtime-hints.txt').read_text()
error=(diag/'forja65-last-error.txt').read_text()
site=0xbbab60; target=0xbbaa53
proof=mod.audit(raw,trace,hints,error,site,target)
assert proof['opcode']=='FC' and proof['observed_x']=='001E'
assert proof['pointer_base']=='A958' and proof['pointer_at']=='BBA976' and proof['pointer_bytes']=='53 AA'
assert proof['return_pc']=='BBAB63' and proof['stack_return_word']=='AB62'
for corrupt in (
    (bytes(raw[:(site&0x3fffff)])+bytes([0x7c])+raw[(site&0x3fffff)+1:], trace,hints,error),
    (raw, trace.replace('bbab60 A=1e X=1e', 'bbab60 A=1e X=0'), hints,error),
    (raw, trace,hints.replace('rom=3a574807afbad761','rom=0000000000000000'),error),
    (raw,trace,hints,error.replace(str(target),str(target+1))),
    (raw, trace+'\nbbab61 A=0 X=1e Y=0 S=0 D=0 DB=bb PB=bb P=0 E=0 M=0 X8=0 C=0\n',hints,error),
):
    try: mod.audit(*corrupt,site,target)
    except ValueError: pass
    else: raise AssertionError('Adulterated evidence was accepted')
print('INDEXED_JSR_AUDIT_PASS: genuine ROM+X+pointer+return; 5 negative cases rejected')
# The JavaScript emitter must *independently* reject a forged return address,
# opcode and destination even when a caller fabricates a JSON proof.
from tempfile import TemporaryDirectory
with TemporaryDirectory(prefix='rie-jsr-test-') as folder:
    folder=Path(folder)
    for key,value in [('return_pc','BBAB64'), ('pointer_bytes','FF AA')]:
        altered=dict(proof)
        altered[key]=value
        claim=folder/f'{key}.json'
        claim.write_text(json.dumps(altered)+'\n')
        cmd=['node',str(ROOT/'tools/generate-observed-flow.js'), str(project/'assets/cart-data.bin'),
             str(diag/'forja65-runtime-hints.txt'),'BBAA53',str(folder/key),
             '--verified-target','--indexed-jsr-proof',str(claim)]
        proc=subprocess.run(cmd, capture_output=True, text=True)
        assert proc.returncode!=0, f'Emitter accepted altered {key}'
print('INDEXED_JSR_EMITTER_GUARDS_PASS: altered return PC and pointer rejected')
