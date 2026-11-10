#!/usr/bin/env python3
"""Prove fixture isolation and deterministic, provenance-bearing generation."""
import argparse, hashlib, json, pathlib, subprocess, sys, tempfile
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--port',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[2])
ROOT=p.parse_args().port.resolve()
GEN=pathlib.Path(__file__).resolve().with_name('generate.py')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
def run(*args,ok):
 r=subprocess.run([sys.executable,str(GEN),'--port',str(ROOT),*map(str,args)],text=True,capture_output=True)
 assert (r.returncode==0)==ok,(r.returncode,r.stdout,r.stderr)
 return r
production=[ROOT/'src/spc700_native.cpp',ROOT/'tools/spc-aot/compiled-pairs.json']
before=list(map(digest,production))
with tempfile.TemporaryDirectory() as temp:
 t=pathlib.Path(temp);cpp=t/'fixture.cpp';pairs=t/'fixture.json'
 run('--test-all-opcodes',ok=False)
 run('--test-all-opcodes','--output',cpp,ok=False)
 run('--test-all-opcodes','--pairs-output',pairs,ok=False)
 for default in production:
  run('--test-all-opcodes','--output',default,'--pairs-output',pairs,ok=False)
  run('--test-all-opcodes','--output',cpp,'--pairs-output',default,ok=False)
 run('--test-all-opcodes','--output',cpp,'--pairs-output',pairs,ok=True)
 source=cpp.read_bytes();meta=json.loads(pairs.read_text())
 assert meta['fixture_only'] and len({op for pc,op in meta['pairs']})==256
 assert b'forja65SpcStep(' not in source and b'forja65SpcPredictCycles(' not in source
 assert hashlib.sha256(source).hexdigest()==meta['source_sha256']
 # Fixture marker is refused even if a caller relabels its format as observations.
 bad=t/'bad-profile.json';meta['format']='forja65-spc-observed-pairs-v1';bad.write_text(json.dumps(meta))
 run(bad,'--output',t/'bad.cpp','--pairs-output',t/'bad-map.json',ok=False)
 # The generic empty profile grants IPL boundaries only, never RAM instructions.
 empty=t/'empty.json';empty.write_text(json.dumps({'format':'forja65-spc-observed-pairs-v1','pairs':[]}))
 args=[empty,'--output',t/'native.cpp','--pairs-output',t/'map.json']
 run(*args,ok=True);first=(t/'native.cpp').read_bytes(),(t/'map.json').read_bytes()
 run(*args,ok=True);assert first==((t/'native.cpp').read_bytes(),(t/'map.json').read_bytes())
 m=json.loads(first[1]);assert len(m['pairs'])==32 and m['observed_pair_count']==0 and m['ipl_supplement_count']==32
 assert m['profiles'][0]['sha256']==digest(empty)
assert before==list(map(digest,production))
print('PASS: fixture paths isolated; fixture evidence rejected; deterministic generation; production files unchanged; empty profile grants 32 IPL starts only')
