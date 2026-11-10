from pathlib import Path
import importlib.util
import sys
root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('longaudit', root/'tools/audit-long-indirect-flow.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
rom = bytearray(b'\xff' * 0x10000)
rom[0x8000:0x8003] = b'\xdc\x1a\x00'
rom[0x808c:0x808e] = b'\xea\x6b'
identity = mod.fnv64(rom)
base = f'rom={identity} from=c08000 ptr=1a bytes=8c,80,c0 target=c0808c e=0 m=0 x=0 c=1 d=0 frame=14810 instruction=96114432'
def ok(line): return mod.audit(rom,[line],0xc08000,0xc0808c)
r = ok(base)
assert r['status']=='LIVE_EVIDENCE_REVALIDATED' and r['validated_log_records']==1
assert r['observations'][0]['pointer_bytes']==['8C','80','C0']
assert not mod.audit(rom,[],0xc08000)['validated_log_records']
for changed in (base.replace('c0808c','c0808d'),base.replace('bytes=8c,80,c0','bytes=8d,80,c0'),
                base.replace('ptr=1a','ptr=1b'),base.replace('from=c08000','from=c08003'),
                base.replace(f'rom={identity}', 'rom=0000000000000000'),
                base.replace('e=0 m=0 x=0','e=1 m=0 x=0'),
                base.replace('c=1','c=2'),base.replace('target=c0808c','target=7e808c')):
    assert not ok(changed)['validated_log_records'], changed
assert not mod.audit(rom,[base],0xc08001)['validated_log_records']
rom[0x8000] = 0xea
assert not mod.audit(rom,[base],0xc08000)['validated_log_records']
print('LONG_INDIRECT_FLOW_PASS verified=1 negative=11')
