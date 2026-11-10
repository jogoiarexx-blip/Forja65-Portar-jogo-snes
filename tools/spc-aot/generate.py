#!/usr/bin/env python3
"""Emit guarded, PC-bound SPC native operations from executed PC/opcode pairs.

Only runtime observation files and immutable IPL instruction boundaries are input.
RAM dumps are deliberately unsupported: executable-looking data is not evidence.
Operand bytes remain live to preserve self-modifying operands and bus semantics.
The reference opcode switch is inspected at generation time only. The output has
no opcode decoder, interpreter call, timing decoder, or unsupported fallback.
"""
import argparse, hashlib, json, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('profiles',nargs='*',type=pathlib.Path)
p.add_argument('--port',type=pathlib.Path,default=ROOT,help='Port project root containing src/runtime.hpp')
p.add_argument('--output',type=pathlib.Path)
p.add_argument('--pairs-output',type=pathlib.Path)
p.add_argument('--test-all-opcodes',action='store_true',help='Synthetic isolated semantic fixture; NEVER use for production coverage')
a=p.parse_args()
ROOT=a.port.resolve()
production_output=(ROOT/'src/spc700_native.cpp').resolve()
production_pairs=(ROOT/'tools/spc-aot/compiled-pairs.json').resolve()
if a.test_all_opcodes:
 if a.output is None or a.pairs_output is None:
  p.error('--test-all-opcodes requires separate explicit --output and --pairs-output paths')
 if a.output.resolve() in (production_output,production_pairs) or a.pairs_output.resolve() in (production_output,production_pairs):
  p.error('synthetic fixtures cannot overwrite either production default')
a.output=a.output or ROOT/'src/spc700_native.cpp'
a.pairs_output=a.pairs_output or ROOT/'tools/spc-aot/compiled-pairs.json'
if a.output.resolve()==a.pairs_output.resolve():p.error('source and pair outputs must be different files')
runtime=(ROOT/'src/runtime.hpp').read_text()
# This generator deliberately targets the supplied port's scheduler/ABI, rather
# than silently transplanting a newer Forja accurateSpcTiming implementation.
for required in ('bool preciseSpcTiming','case 0xEF: s.spc.pc--; break;',
                 'case 0xFF: s.spc.pc--; break;',
                 'while(spcMasterRemainder>=42u)',
                 'static constexpr std::uint64_t spcCpuHz=1024000ull;'):
 if required not in runtime:raise ValueError(f'unsupported runtime semantic shape: missing {required!r}')
step=runtime.split('inline int forja65SpcStep(ApuBridge& s) {',1)[1].split('inline void ApuBridge::tickMasterCycles',1)[0]
lambdas=step.split('    auto dp =',1)[1].split('    switch (op) {',1)[0]
lambdas=('    auto dp ='+lambdas).replace('    auto ', '    [[maybe_unused]] auto ')
switch=step.split('    switch (op) {',1)[1].split('    default: break;',1)[0]
labels=list(re.finditer(r'case 0x([0-9A-Fa-f]{2}):',switch)); bodies={}; pending=[]
for i,m in enumerate(labels):
 pending.append(int(m[1],16)); body=switch[m.end():labels[i+1].start() if i+1<len(labels) else len(switch)].strip()
 if body:
  for op in pending:bodies[op]=body
  pending=[]
assert len(bodies)==256
cycles=[int(x) for x in re.findall(r'\d+',runtime.split('kForja65SpcCycles[256] = {',1)[1].split('};',1)[0])]
assert len(cycles)==256
pairs=set(); provenance=[]
for f in a.profiles:
 data=json.loads(f.read_text())
 if data.get('fixture_only'):raise ValueError(f'{f}: synthetic fixtures cannot train production')
 if data.get('format')!='forja65-spc-observed-pairs-v1':raise ValueError(f'{f}: expected executed pair profile')
 for pc,op in data['pairs']:
  if type(pc) is not int or type(op) is not int or not (0<=pc<65536 and 0<=op<256):raise ValueError((pc,op))
  pairs.add((pc,op))
 provenance.append({'name':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'pair_count':len(set(map(tuple,data['pairs'])))})
observed_pairs=set(pairs)
# The boot ROM is immutable while mapped. These are actual instruction starts,
# not a RAM CFG. Its final two bytes are a vector, never an instruction seed.
ipl=[int(x,16) for x in re.findall(r'0x([0-9A-Fa-f]{2})',runtime.split('kForja65Ipl[64] = {',1)[1].split('};',1)[0])]
lengths={}
for op,body in bodies.items():
 n=1
 for name,size in [('sf16',2),('sf',1),('dp',1),('dpx',1),('dpy',1),('absx',2),('absy',2),('idpx',1),('idpy',1),('bitAddr',2)]:
  n+=len(re.findall(r'\b'+name+r'\(',body))*size
 lengths[op]=n
pc=0xffc0
while pc<0xfffe:
 op=ipl[pc-0xffc0];pairs.add((pc,op));pc+=lengths[op]
assert pc==0xfffe,hex(pc)
ipl_supplement_count=len(pairs-observed_pairs)
if a.test_all_opcodes:pairs.update((0x2000+op*4,op) for op in range(256))
pairs=sorted(pairs)
peek=runtime.split('static std::uint8_t forja65SpcPeek(',1)[1].split('static unsigned forja65SpcPredictCycles',1)[0]
peek='static std::uint8_t nativePeek('+peek
advance=step.split('    if(s.preciseSpcTiming) forja65SpcAdvanceTimers',1)[1].split('    return int(cycles);',1)[0]
advance='    if(s.preciseSpcTiming) forja65SpcAdvanceTimers'+advance
# Fixed opcode branch conditions. No runtime opcode decoding is emitted.
conds={0x10:'!(s.spc.psw&CN)',0x30:'(s.spc.psw&CN)!=0',0x50:'!(s.spc.psw&CV)',0x70:'(s.spc.psw&CV)!=0',0x90:'!(s.spc.psw&CC)',0xb0:'(s.spc.psw&CC)!=0',0xd0:'!(s.spc.psw&CZ)',0xf0:'(s.spc.psw&CZ)!=0',0x2e:'dpmem(operand)!=s.spc.a()',0xde:'dpmem(std::uint8_t(operand+s.spc.x))!=s.spc.a()',0x6e:'std::uint8_t(dpmem(operand)-1u)!=0',0xfe:'std::uint8_t(s.spc.y()-1u)!=0'}
for op in range(256):
 if op&15==3:
  conds[op]=('!' if op&16 else '')+f'((dpmem(operand)&{1<<((op>>5)&7)})!=0)'
out=['// GENERATED by tools/spc-aot/generate.py. Do not edit.\n// Fixed PC/opcode specialization; live operands; unknown code fails closed.\n#include "runtime.hpp"\n#include <sstream>\nnamespace {\n',peek]
out.append('static void advanceNativeTimers(ApuBridge& s,unsigned cycles){\n'+advance+'}\n')
for op in sorted(set(op for _,op in pairs)):
 cond=conds.get(op,'false')
 out.append(f'static unsigned cost_{op:02x}([[maybe_unused]] const ApuBridge& s){{\n')
 if op in conds:
  out.append(' const auto operand=nativePeek(s,std::uint16_t(s.spc.pc+1));\n [[maybe_unused]] const auto dpmem=[&](unsigned off){return nativePeek(s,std::uint16_t(((s.spc.psw&CP)?0x100:0)+(off&255)));};\n')
 out.append(f' return {cycles[op]}u+(({cond})?2u:0u);\n}}\n')
for pc,op in pairs:
 body=re.sub(r'\bop\b',f'0x{op:02x}u',bodies[op])
 out.append(f'static int pc_{pc:04x}_{op:02x}(ApuBridge& s){{\n bool branchTaken=false;\n (void)sr(s,0x{pc:04x}); s.spc.pc=0x{(pc+1)&65535:04x};\n'+lambdas+' do { '+body+' } while(false);\n'+f' const unsigned cycles={cycles[op]}u+((s.preciseSpcTiming&&branchTaken)?2u:0u);\n advanceNativeTimers(s,cycles);return int(cycles);\n}}\n')
out.append('struct Entry{unsigned(*cost)(const ApuBridge&);int(*execute)(ApuBridge&);};\nstatic Entry findNative(const ApuBridge& s){\n const auto opcode=nativePeek(s,s.spc.pc);\n switch(s.spc.pc){\n')
pcs={}
for pc,op in pairs:pcs.setdefault(pc,[]).append(op)
for pc,ops in pcs.items():
 out.append(f' case 0x{pc:04x}:\n')
 for op in ops:out.append(f'  if(opcode==0x{op:02x})return {{cost_{op:02x},pc_{pc:04x}_{op:02x}}};\n')
 out.append('  break;\n')
out.append(' default:break;\n }\n std::ostringstream msg;msg<<"SPC native coverage miss pc=0x"<<std::hex<<s.spc.pc<<" opcode=0x"<<unsigned(opcode);throw std::runtime_error(msg.str());\n}\n')
out.append('static void nativeTick(ApuBridge& s,unsigned clocks){\n if(!s.preciseSpcTiming){s.spcMasterRemainder+=clocks;while(s.spcMasterRemainder>=42){const auto entry=findNative(s);s.spcMasterRemainder-=42;entry.execute(s);}}\n else{s.spcMasterRemainder+=std::uint64_t(clocks)*1024000ull;while(true){const auto entry=findNative(s);const auto cost=std::uint64_t(entry.cost(s))*ApuBridge::DSP_MASTER_HZ;if(s.spcMasterRemainder<cost)break;s.spcMasterRemainder-=cost;entry.execute(s);}}\n}\n}\n')
out.append('int forja65SpcNativeStep(ApuBridge& s){return findNative(s).execute(s);}\nunsigned forja65SpcNativePredict(const ApuBridge& s){return findNative(s).cost(s);}\nvoid forja65InstallSpcNative(ApuBridge& s){s.setNativeStepHook(nativeTick);}\nbool forja65SpcNativePair(unsigned i,std::uint16_t& pc,std::uint8_t& op){\n static constexpr unsigned pairs[]={\n')
out.append(','.join(f'0x{pc:04x}{op:02x}u' for pc,op in pairs))
out.append('\n};if(i>=sizeof(pairs)/sizeof(pairs[0]))return false;pc=std::uint16_t(pairs[i]>>8);op=std::uint8_t(pairs[i]);return true;}\n')
source=''.join(out)
assert 'forja65SpcStep(' not in source and 'forja65SpcPredictCycles(' not in source
assert 'switch (op)' not in source
for f in [a.output,a.pairs_output]:f.parent.mkdir(parents=True,exist_ok=True)
a.output.write_text(source)
a.pairs_output.write_text(json.dumps({'format':'forja65-spc-compiled-pairs-v1','fixture_only':a.test_all_opcodes,'runtime_sha256':hashlib.sha256(runtime.encode()).hexdigest(),'generator_sha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'source_sha256':hashlib.sha256(source.encode()).hexdigest(),'profiles':provenance,'observed_pair_count':len(observed_pairs),'ipl_supplement_count':ipl_supplement_count,'pairs':pairs},indent=2)+'\n')
print(f'Generated {len(pairs)} guarded PC/op pairs ({len(set(op for _,op in pairs))} opcode forms) -> {a.output}')
