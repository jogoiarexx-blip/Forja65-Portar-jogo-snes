#!/usr/bin/env python3
"""Rebuild the core merge in a temporary directory and compare its exact bytes."""
from pathlib import Path
import hashlib,json,re,subprocess,tempfile

root=Path(__file__).resolve().parents[1]
inputs=root/'merge-evidence/rev144'
pattern=r'^<<<<<<<[^\n]*\n(.*?)^=======\n(.*?)^>>>>>>>[^\n]*\n'
def merge(ours,base,theirs):
    return subprocess.run(['git','merge-file','-p',str(ours),str(base),str(theirs)],stdout=subprocess.PIPE,text=True,check=False).stdout
with tempfile.TemporaryDirectory(prefix='rev144-merge-') as temporary:
    temp=Path(temporary)
    source={name:(inputs/file).read_text() for name,file in [('ours','cpu-resume143-core.js'),('base','base142-core.js'),('theirs','timing143-core.js')]}
    for name,text in source.items():
        match=re.search(r'const FORJA65_RUNTIME_CONTROL_SNIPPET=("(?:\\.|[^"\\])*");',text)
        assert match,name
        (temp/(name+'.hpp')).write_text(json.loads(match.group(1)))
    snippet=merge(temp/'ours.hpp',temp/'base.hpp',temp/'theirs.hpp')
    assert not re.search(pattern,snippet,re.M|re.S)
    assert snippet.count('inputReplay.clear();')==1
    snippet=snippet.replace('inputReplay.clear();','inputReplay.clear();inputReplayPos=0;')
    combined=merge(inputs/'cpu-resume143-core.js',inputs/'base142-core.js',inputs/'timing143-core.js')
    conflicts=list(re.finditer(pattern,combined,re.M|re.S))
    assert len(conflicts)==2,len(conflicts)
    def resolve(match):
        ours,theirs=match.groups()
        if 'std::uint32_t readBus' in ours:
            assert 'apu.cpuReadLagMc=cpuApuReadLag()' in theirs
            return theirs.replace('lo<=0x2143','lo<=0x217F').replace('apu.read(lo-0x2140,','apu.read(lo&3u,')
        assert ours.startswith('const FORJA65_RUNTIME_CONTROL_SNIPPET=')
        return 'const FORJA65_RUNTIME_CONTROL_SNIPPET='+json.dumps(snippet)+';\n'
    final=re.sub(pattern,resolve,combined,flags=re.M|re.S)
    old="  t=t.replace('endVblank();beginFrame();','endVblank();if(controlMode&&stopped)return;beginFrame();');"
    new="  const stopBoundary='endVblank();longFieldThisFrame=false;beginFrame();';\n  if(t.split(stopBoundary).length!==2)throw new Error('Missing unique control stop scheduler boundary');\n  t=t.replace(stopBoundary,'endVblank();if(controlMode&&stopped)return;longFieldThisFrame=false;beginFrame();');"
    assert final.count(old)==1
    final=final.replace(old,new)
    old='if(controlMode&&controlAtVblank)controlFrame();io.vblank=true;'
    assert final.count(old)==1
    final=final.replace(old,'if(controlMode&&controlAtVblank){controlFrame();if(stopped)return;}io.vblank=true;')
    for fix in json.loads((inputs/'additional-fixes.json').read_text()):
        assert final.count(fix['old'])==1,fix['name']
        final=final.replace(fix['old'],fix['new'])
    actual=final.encode()
    expected=(root/'forja65-core.js').read_bytes()
    assert actual==expected,'core differs from independently rebuilt merge'
    print('REV144_MERGE_REPRODUCIBLE_PASS '+hashlib.sha256(actual).hexdigest())
