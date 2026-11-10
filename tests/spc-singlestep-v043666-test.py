"""Independent SingleStepTests corpus: all opcodes, excluding mapped I/O.

Checks registers, listed final RAM, and total instruction cycles. It does
not assert a per-bus-cycle trace or APU integration/PCM equivalence.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / 'tests/vendor/spc700-singlestep-v1.zip'

def main():
    assert hashlib.sha256(CORPUS.read_bytes()).hexdigest() == '1123dcf0d1fa4208b687bda21693944e8cea424954d0630780fcb218d236a479', 'unexpected corpus bytes'
    with tempfile.TemporaryDirectory(prefix='forja-spc-sst-66-') as tmp:
        dest = Path(tmp)
        js = """const F=require(process.argv[1]),fs=require('fs'),path=require('path');
const r=F.loadRom(F.makeSyntheticRom());const p=F.generateProject(r,F.analyze(r,128));
for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(process.argv[2],n),p['src/'+n]);"""
        core = os.environ.get('FORJA65_SOURCE_CORE', str(ROOT / 'forja65-core.js'))
        subprocess.run(['node','-e',js,core,str(dest)],check=True)
        accepted = excluded = 0
        with zipfile.ZipFile(CORPUS) as z, (dest/'vectors.txt').open('w') as out:
            for op in range(256):
                vectors=json.loads(z.read(f'spc700-main/v1/{op:02x}.json'))
                for index,v in enumerate(vectors):
                    initial,final=v['initial'],v['final']
                    addresses=[p[0] for p in initial['ram']+final['ram']]
                    addresses += [p[0] for p in v['cycles'] if p[0] is not None]
                    if any(0xf0 <= a <= 0xff for a in addresses):
                        excluded+=1
                        continue
                    fields=[op,index]+[initial[k] for k in ('pc','a','x','y','sp','psw')]+[len(initial['ram'])]
                    fields += [n for pair in initial['ram'] for n in pair]
                    fields += [final[k] for k in ('pc','a','x','y','sp','psw')]+[len(v['cycles']),len(final['ram'])]
                    fields += [n for pair in final['ram'] for n in pair]
                    out.write(' '.join(map(str,fields))+'\n')
                    accepted+=1
        print(f'CORPUS sha256={hashlib.sha256(CORPUS.read_bytes()).hexdigest()} accepted={accepted} io_excluded={excluded}',flush=True)
        for opt in os.environ.get('FORJA65_TEST_LEVELS','-O0,-O2').split(','):
            assert opt in ('-O0','-O1','-O2')
            exe=dest/('probe.exe' if os.name=='nt' else 'probe')
            subprocess.run([os.environ.get('CXX','g++'),'-std=c++20',opt,'-I'+str(dest),str(ROOT/'tests/fixtures/spc_singlestep_v043666.cpp'),'-o',str(exe)]+(['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm'] if os.name=='nt' else []),check=True,timeout=120)
            print('OPTIMIZATION '+opt,flush=True)
            run=subprocess.run([str(exe),str(dest/'vectors.txt')],text=True,capture_output=True,timeout=180)
            print(run.stdout,end='',flush=True)
            print(run.stderr,end='',flush=True)
            if run.returncode:return run.returncode
    return 0

if __name__=='__main__':raise SystemExit(main())
