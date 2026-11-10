#!/usr/bin/env python3
"""Add native opcode specializations to a legacy HiROM, eight-argument timing port.

The port's immutable interpreter supplies C++ semantics at generation time only.
No emitted function reads an opcode or operand from executable memory at runtime.
The immutable baseline dispatch determines ownership and ordering.
"""
import argparse, hashlib, json, pathlib, re

def fnv(data):
    h=1469598103934665603
    for b in data:h=((h^b)*1099511628211)&0xffffffffffffffff
    return f'{h:016x}'

def romoff(pc, size):
    bank,lo=pc>>16,pc&65535
    if bank in (0x7e,0x7f) or (lo<0x8000 and not (0x40<=bank<=0x7d or bank>=0xc0)):return None
    off=((bank&0x3f)<<16)|lo
    # SnesRuntime::mirrorOffset (also works for non-power-of-two cartridges).
    base=0;mask=1<<23
    while off>=size:
        while mask and not(off&mask):mask>>=1
        if not mask:raise ValueError('Invalid cartridge size')
        off-=mask
        if size>mask:size-=mask;base+=mask
        mask>>=1
    return base+off

def section(text, name):
    m=re.search(r'(static const '+name+r'\[\]=\{\n)(.*?)(\n\};)',text,re.S)
    if not m:raise ValueError('Missing immutable baseline table: '+name)
    return m

def truth(v):return 'true' if v else 'false'
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--native-unit-count',type=int,default=43);p.add_argument('--port',required=True,type=pathlib.Path);p.add_argument('--analysis',required=True,type=pathlib.Path);p.add_argument('--baseline-dir',required=True,type=pathlib.Path)
    a=p.parse_args();port=a.port.resolve();base=a.baseline_dir.resolve();analysis=json.loads(a.analysis.read_text());rom=(port/'assets/cart-data.bin').read_bytes();rh=fnv(rom)
    if analysis.get('mapping')!='HiROM':raise ValueError('Only legacy HiROM analysis is supported')
    if analysis.get('rom')!=rh:raise ValueError('Analysis ROM identity mismatch: expected '+rh)
    source=(port/'src/forja_cpu_interpreter.cpp').read_text();runtime=(port/'src/runtime.hpp').read_text();dispatch=(base/'dispatch.cpp').read_text()
    timing=re.search(r'void advanceCpuInstruction\(([^)]*)\)',runtime)
    if not timing or len(timing.group(1).split(','))!=8:raise ValueError('Only legacy eight-parameter timing ABI is supported')
    if 'Forja65DispatchEntry{std::uint32_t pc;bool e,m,x,carryKnown,c;' not in dispatch:raise ValueError('Unsupported legacy dispatch ABI')
    if len(re.findall(r'static void forja65_i[0-4]_[0-9a-f]{2}\(',source))!=1280:raise ValueError('Unsupported interpreter opcode ABI (need five complete mode tables)')
    bodies={}
    for m in re.finditer(r'static void forja65_i([0-4])_([0-9a-f]{2})\(CpuState&cpu,SnesRuntime&hw,std::uint32_t ipc,std::uint32_t opL\)\{\n(.*?)\n\}',source,re.S):
        body=re.sub(r'^  const std::uint32_t opW=.*?\n','',m.group(3),count=1)
        bodies[int(m[1]),int(m[2],16)]=body
    if len(bodies)!=1280:raise ValueError('Cannot extract immutable legacy opcode bodies')
    helpers=source[source.index('// REV134 legacy stack adapter:'):source.index('  #if defined(__GNUC__)')]
    dm=section(dispatch,'Forja65DispatchEntry kForja65Dispatch');am=section(dispatch,'Forja65AliasEntry kForja65Aliases')
    oldrows=[];covered={}
    for line in dm[2].splitlines():
        m=re.fullmatch(r'\{0x([0-9A-Fa-f]+)u,(true|false),(true|false),(true|false),(true|false),(true|false),&([^,]+),0x([0-9A-Fa-f]+)u\},',line)
        if not m:raise ValueError('Unrecognized baseline dispatch row: '+line[:100])
        pc=int(m[1],16);e,mi,x,ck,c=[z=='true' for z in m.groups()[1:6]]
        oldrows.append((pc,line));off=romoff(pc,len(rom))
        key=(off,pc&65535,e,mi,x)
        covered.setdefault(key,set()).update([c] if ck else [False,True])
    observed={(s['target'],s['state']['emulation'],s['state']['m8'],s['state']['x8']) for s in analysis.get('observedEntries',[])}
    instructions={};excluded=[]
    for f in analysis.get('functions',[]):
      for i in f.get('instructions',[]):
        pc=i['pc'];st=i.get('stateIn',i.get('state'));raw=i.get('raw',i.get('bytes'))
        if not st or not isinstance(raw,list) or not 1<=len(raw)<=4:raise ValueError('Every instruction must carry raw ROM bytes and stateIn')
        e,mi,x=[st.get(k) for k in ('emulation','m8','x8')]
        if not all(isinstance(v,bool) for v in (e,mi,x)) or (e and not(mi and x)):raise ValueError('Invalid E/M/X decode state')
        off=romoff(pc,len(rom))
        if off is None:continue
        for n,b in enumerate(raw):
            ro=romoff((pc&0xff0000)|((pc+n)&65535),len(rom))
            if ro is None or rom[ro]!=b:raise ValueError(f'Raw instruction mismatch at {pc:06X}+{n}')
        # Existing negative conformance fixture is not an observed execution route.
        if pc==0xc0fce1 and mi and (pc,e,mi,x) not in observed:
            excluded.append(f'{pc:06X} M1');continue
        carry=st.get('carry');key=(off,pc&65535,e,mi,x)
        need=({False,True} if carry is None else {bool(carry)})-covered.get(key,set())
        if not need:continue
        # Same physical byte/width can have several graph stack contexts.
        prev=instructions.get((pc,e,mi,x))
        if prev and prev['raw']!=raw:raise ValueError('Conflicting instruction bytes')
        if not prev:instructions[pc,e,mi,x]={'pc':pc,'e':e,'m':mi,'x':x,'raw':raw,'need':set(),'mnemonic':i.get('mnemonic','')}
        instructions[pc,e,mi,x]['need'].update(need)
    entries=[];newrows=[];decl=[]
    for key,i in sorted(instructions.items()):
        pc,e,mi,x=key;physical=(romoff(pc,len(rom)),pc&65535,e,mi,x)
        need=i['need']-covered.get(physical,set())
        if not need:continue
        name=f'forja65_aot_{pc:06X}_E{int(e)}M{int(mi)}X{int(x)}';i['fn']=name;i['need']=sorted(need);entries.append(i)
        decl.append(f'void {name}(CpuState&,SnesRuntime&,std::uint32_t);')
        cs=[None] if len(need)==2 else sorted(need)
        for c in cs:newrows.append((pc,'{0x%06Xu,%s,%s,%s,%s,%s,&%s,0x%06Xu},'%(pc,truth(e),truth(mi),truth(x),truth(c is not None),truth(bool(c)),name,pc)))
        covered.setdefault(physical,set()).update(need)
    # Stable sorting leaves every old row and its owner in its original relative order.
    rows=sorted(oldrows+newrows,key=lambda x:x[0]);dispatch=dispatch[:dm.start(2)]+'\n'.join(r[1] for r in rows)+dispatch[dm.end(2):]
    am=section(dispatch,'Forja65AliasEntry kForja65Aliases');aliases=[];oldpcs=set()
    for line in am[2].splitlines():
        m=re.fullmatch(r'\{0x([0-9A-Fa-f]+)u,0x([0-9A-Fa-f]+)u\},',line)
        if not m:raise ValueError('Unrecognized baseline alias row '+line)
        aliases.append((int(m[1],16),line));oldpcs.add(int(m[2],16))
    addedpcs=sorted({i['pc'] for i in entries}-oldpcs)
    for pc in addedpcs:
        off=romoff(pc,len(rom));aliases.append((off,f'{{0x{off:X}u,0x{pc:06X}u}},'))
    # Crucial: append equal-offset aliases after old aliases, preserving their priority.
    aliases.sort(key=lambda x:x[0]);dispatch=dispatch[:am.start(2)]+'\n'.join(r[1] for r in aliases)+dispatch[am.end(2):]
    dispatch=dispatch.replace('struct Forja65DispatchEntry{','\n'.join(decl)+'\nstruct Forja65DispatchEntry{',1)
    # A real RTL may redirect to any compiled physical instruction, not only old labels.
    stack=re.search(r'(static const std::uint32_t kForja65StackReturnOffsets\[\]=\{)(.*?)(\};)',dispatch,re.S)
    if not stack:raise ValueError('Missing immutable baseline stack-return offsets')
    oldoffsets={int(v,16) for v in re.findall(r'0x([0-9a-fA-F]+)u',stack[2])}
    offsets=oldoffsets|{romoff(i['pc'],len(rom)) for i in entries}
    dispatch=dispatch[:stack.start(2)]+','.join(f'0x{v:06X}u' for v in sorted(offsets))+dispatch[stack.end(2):]
    if a.native_unit_count<1:raise ValueError('Native unit count must be positive')
    units=[];outputs={};prefix='// Generated by compile-legacy-observed-aot.py; ROM-bound native specializations.\n#include "generated.hpp"\n#include <stdexcept>\n'+helpers+'\n'
    for unit in range(a.native_unit_count):
        n=unit*100;end=(n+100) if unit+1<a.native_unit_count else len(entries)
        filename=f'forja_cpu_observed_{unit:03}.cpp';units.append('src/'+filename);text=prefix
        if unit==0:text+=f'void forja65_legacy_observed_verify_rom(const SnesRuntime&hw){{if(hw.mapper!=MapperKind::HiROM||hw.cartHashValue()!=0x{rh}ULL)throw std::runtime_error("legacy observed AOT ROM identity mismatch");}}\n'
        for i in entries[n:end]:
            pc=i['pc'];mode=0 if i['e'] else 1+(2 if i['m'] else 0)+(1 if i['x'] else 0)
            operand=sum(b<<(8*j) for j,b in enumerate(i['raw'][1:]));body=bodies[mode,i['raw'][0]]
            for sym,val in [('opL',operand),('opW',operand&65535),('opB',operand&255)]:body=re.sub(r'\b'+sym+r'\b',f'0x{val:X}u',body)
            # Freeze low PC, retain actual runtime PB throughout calls, relative branches and timing.
            ipc=f'((std::uint32_t(actualPb)<<16)|0x{pc&65535:04X}u)'
            body=re.sub(r'\bipc\b',ipc,body)
            text+=f'\n// {pc:06X} {i["mnemonic"]} bytes={bytes(i["raw"]).hex().upper()}\nvoid {i["fn"]}(CpuState&cpu,SnesRuntime&hw,std::uint32_t entryPc){{\n  (void)entryPc;\n  const std::uint8_t actualPb=cpu.pb;\n  if(hw.stopped)return;\n  if(hw.serviceCpuEvents(cpu,{ipc}))return;\n{body}\n}}\n'
        outputs[port/'src'/filename]=text
    header='// Generated entry inventory used by differential and mirror-resolution tests.\n#pragma once\n#include "generated.hpp"\n'+ '\n'.join(decl)+'\nvoid forja65_legacy_observed_verify_rom(const SnesRuntime&);\nstruct Forja65ObservedEntry{std::uint32_t pc;bool e,m,x;unsigned carryMask;std::uint8_t raw[4];void(*fn)(CpuState&,SnesRuntime&,std::uint32_t);};\ninline const Forja65ObservedEntry kForja65ObservedEntries[]={\n'
    for i in entries:
        raw=(i['raw']+[0]*4)[:4];cm=sum(1<<int(c) for c in i['need']);header+='{0x%06Xu,%s,%s,%s,%du,{%s},&%s},\n'%(i['pc'],truth(i['e']),truth(i['m']),truth(i['x']),cm,','.join(f'0x{b:02X}' for b in raw),i['fn'])
    header+='};\n';outputs[port/'src/forja_cpu_observed_entries.hpp']=header;outputs[port/'src/dispatch.cpp']=dispatch
    manifest={'schema':'forja65.legacy-observed-aot.v1','rom':rh,'mapping':'HiROM','timingABI':8,'baselineDispatchSha256':hashlib.sha256((base/'dispatch.cpp').read_bytes()).hexdigest(),'legacyInterpreterSha256':hashlib.sha256(source.encode()).hexdigest(),'nativeUnitCount':len(units),'stackReturnOffsetsAdded':len(offsets-oldoffsets),'functions':len(entries),'dispatchRowsAdded':len(newrows),'physicalAliasesAdded':len(addedpcs),'units':units,'observedEntryCount':len(analysis.get('observedEntries',[])),'excludedUnobservedFixture':sorted(set(excluded)),'entries':entries}
    manifest['files']={str(p.relative_to(port)):{'fnv1a64':fnv(t.encode()),'bytes':len(t.encode())} for p,t in outputs.items()}
    outputs[port/'analysis/legacy-observed-aot-manifest.json']=json.dumps(manifest,indent=2)+'\n'
    outputs[port/'analysis/legacy-observed-aot-cmake.txt']='\n'.join('  '+u for u in units)+'\n'
    for old in (port/'src').glob('forja_cpu_observed_*.cpp'):
        if old not in outputs:old.unlink()
    for dest,text in outputs.items():
        dest.parent.mkdir(parents=True,exist_ok=True)
        if not dest.exists() or dest.read_text()!=text:dest.write_text(text)
    print(json.dumps({k:manifest[k] for k in ['rom','functions','dispatchRowsAdded','physicalAliasesAdded','observedEntryCount','excludedUnobservedFixture']}))
if __name__=='__main__':main()
