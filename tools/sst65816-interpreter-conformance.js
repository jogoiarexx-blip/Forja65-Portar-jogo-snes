#!/usr/bin/env node
'use strict';
// Forja65 REV133 — conformidade do INTERPRETADOR 65C816 de fallback (tools/gen-cpu-interpreter.js)
// contra SingleStepTests/65816 (MIT). Mesmo criterio do sst65816-conformance.js: estado, memoria,
// ordem dos acessos de dados e ciclos. Os bytes de instrucao vem da memoria do vetor em tempo de execucao.
// Every vector runs through the generated runtime interpreter on a flat 16 MB test bus, once,
// and compared on: registers/flags/PC/PB, memory, ordered data-bus accesses and CPU cycle count.
// The flat bus is a TEST-ONLY patch of a temporary runtime copy; generated ports are unchanged.
//
// Usage:
//   node tools/sst65816-interpreter-conformance.js <SingleStepTests/65816/v1 dir | fixture.json> [--per N] [--core forja65-core.js] [--json out.json]
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),Module=require('module');
function arg(name,def){const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:def;}
const input=process.argv[2];if(!input){console.error('uso: node tools/sst65816-interpreter-conformance.js <dir|fixture.json> [--per N]');process.exit(2);}
const corePath=path.resolve(arg('--core',path.join(__dirname,'..','forja65-core.js')));
const per=+arg('--per','60');
function loadCoreInternals(p){
  let src=fs.readFileSync(p,'utf8');const marker='return {...Framework,';const at=src.lastIndexOf(marker);
  if(at<0)throw new Error('marcador de export nao encontrado em '+p);
  src=src.slice(0,at)+'return {__generateVariantBody:generateVariantBody,__flowTarget:flowTarget,...Framework,'+src.slice(at+marker.length);
  const m=new Module(p,null);m.filename=p;m.paths=Module._nodeModulePaths(path.dirname(p));m._compile(src,p);return m.exports;
}
function flatRuntime(text){
  const rep=(o,n)=>{if(!text.includes(o))throw new Error('ancora de runtime ausente: '+o.slice(0,80));text=text.replace(o,n);};
  rep('struct SnesRuntime {','struct SnesRuntime {\n  std::uint8_t* sstFlat{}; struct SstAccess{std::uint32_t a;std::uint8_t v;bool w;}; std::vector<SstAccess> sstLog; unsigned sstCycles{},sstExtra{};');
  rep('  std::uint32_t read(std::uint32_t a,const char*dummy="unknown"){','  std::uint32_t read(std::uint32_t a,const char*dummy="unknown"){\n    if(sstFlat){a&=0xFFFFFFu;auto v=sstFlat[a];sstLog.push_back({a,v,false});cpuDataBus=v;return v;}');
  rep('  void write8(std::uint32_t a,std::uint8_t v,const char*dummy="unknown"){','  void write8(std::uint32_t a,std::uint8_t v,const char*dummy="unknown"){if(sstFlat){a&=0xFFFFFFu;sstFlat[a]=v;sstLog.push_back({a,v,true});return;}');
  rep('  void addCpuInternalCycles(unsigned cycles){','  void addCpuInternalCycles(unsigned cycles){if(sstFlat){sstExtra+=cycles;return;}');
  // Keep optional timing operands (REV140+) and support the older eight-operand ABI.
  const timing=text.match(/void advanceCpuInstruction\([^{}]*\)\{/);
  if(!timing)throw new Error('ancora de advanceCpuInstruction ausente');
  rep(timing[0],timing[0]+'if(sstFlat){sstCycles+=cpuCycles;return;}');
  rep('  void advanceCpuBlockMove(std::uint32_t pc,std::uint32_t bytes,std::uint8_t srcBank,std::uint8_t dstBank){','  void advanceCpuBlockMove(std::uint32_t pc,std::uint32_t bytes,std::uint8_t srcBank,std::uint8_t dstBank){if(sstFlat){if(!bytes)bytes=0x10000u;sstCycles+=7u*bytes;return;}');
  rep('  void traceInstruction(std::uint32_t pc,const CpuState& cpu,unsigned opcode=256u){','  void traceInstruction(std::uint32_t pc,const CpuState& cpu,unsigned opcode=256u){if(sstFlat)return;');
  return text;
}
const HARNESS=String.raw`#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>
struct SstState{unsigned pc,s,p,a,x,y,dbr,d,pbr,e;};
struct SstByte{unsigned a,v;};struct SstAcc{unsigned a,v,w;};
struct SstCase{std::string name,mn,mode;int size;unsigned cycles;int fn;SstState in,out;std::vector<SstByte> ram,fram;std::vector<SstAcc> acc;};
bool forja65_is_stack_return_target(std::uint32_t,SnesRuntime&){return true;}
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
void forja65_interpret_step(CpuState&,SnesRuntime&,std::uint32_t,const std::uint8_t*);
static int sstRun(size_t nf,const char*file,bool verbose){
  std::vector<SstCase> all;{std::ifstream in(file);unsigned id;while(in>>id){SstCase c;in>>c.name>>c.mn>>c.mode>>c.size>>c.cycles;auto rs=[&](SstState&s){in>>s.pc>>s.s>>s.p>>s.a>>s.x>>s.y>>s.dbr>>s.d>>s.pbr>>s.e;};rs(c.in);rs(c.out);
    auto rr=[&](std::vector<SstByte>&v){size_t k;in>>k;v.resize(k);for(auto&b:v)in>>b.a>>b.v;};rr(c.ram);rr(c.fram);size_t na;in>>na;c.acc.resize(na);for(auto&q:c.acc)in>>q.a>>q.v>>q.w;if(id<nf){c.fn=(int)id;all.push_back(c);}}}
  static std::uint8_t mem[1u<<24];auto hw=std::make_unique<SnesRuntime>();hw->sstFlat=mem;
  struct K{unsigned total=0,state=0,bus=0,cyc=0,disputed=0;};std::map<std::string,K> per;unsigned tS=0,tB=0,tC=0,tD=0,shown=0;
  for(auto&c:all){
    for(auto&b:c.ram)mem[b.a]=std::uint8_t(b.v);
    CpuState cpu;cpu.e=c.in.e;cpu.unpackP(std::uint8_t(c.in.p));cpu.a=c.in.a;cpu.x=c.in.x;cpu.y=c.in.y;cpu.s=c.in.s;cpu.d=c.in.d;cpu.db=c.in.dbr;cpu.pb=c.in.pbr;
    if(c.in.e){cpu.m8=cpu.x8=true;cpu.enforceEmulation();}
    hw->sstLog.clear();hw->sstCycles=0;hw->sstExtra=0;hw->dispatchPending=false;hw->nativeReturns.clear();hw->stopped=false;
    try{std::uint8_t b[4];for(unsigned k=0;k<4;k++)b[k]=mem[(c.in.pbr<<16)|((c.in.pc+k)&0xFFFFu)];forja65_interpret_step(cpu,*hw,(c.in.pbr<<16)|c.in.pc,b);}catch(const std::exception&e){if(verbose)std::printf("EXC %s %s\n",c.name.c_str(),e.what());}
    const unsigned pc=hw->dispatchPending?(hw->dispatchTarget&0xFFFFu):0xFFFFFFFFu;
    const unsigned pb=hw->dispatchPending?((hw->dispatchTarget>>16)&0xFFu):cpu.pb;
    bool okS=cpu.a==c.out.a&&cpu.x==c.out.x&&cpu.y==c.out.y&&cpu.s==c.out.s&&cpu.d==c.out.d&&cpu.db==c.out.dbr&&pb==c.out.pbr&&pc==c.out.pc&&unsigned(cpu.e)==c.out.e&&cpu.packP()==c.out.p;
    for(auto&b:c.fram)if(mem[b.a]!=b.v)okS=false;
    bool okB=hw->sstLog.size()==c.acc.size();if(okB)for(size_t i=0;i<c.acc.size();i++){auto&g=hw->sstLog[i];auto&w=c.acc[i];if(g.a!=w.a||g.v!=w.v||unsigned(g.w)!=w.w){okB=false;break;}}
    const bool okC=hw->sstCycles+hw->sstExtra==c.cycles;
    // Disputed between references: E=1, DL!=0 (dp,X) pointer high-byte page wrap (ares readDirectX
    // quirk, kept by Forja65) vs SingleStepTests/CLK and Snes9x (no page wrap).
    const bool disputed=c.mode=="DirectIndexedIndirectX"&&c.in.e&&(c.in.d&0xFFu)!=0;
    auto&P=per[c.name.substr(0,4)+" "+c.mn+" "+c.mode];P.total++;
    if(disputed&&(!okS||!okB)){P.disputed++;tD++;okS=okB=true;}
    if(!okS){P.state++;tS++;}if(!okB){P.bus++;tB++;}if(!okC){P.cyc++;tC++;}
    if(verbose&&(!okS||!okB||!okC)&&shown++<100)std::printf("FAIL %s %s %s\n",c.name.c_str(),c.mn.c_str(),c.mode.c_str());
    for(auto&b:c.ram)mem[b.a]=0;for(auto&b:c.fram)mem[b.a]=0;for(auto&g:hw->sstLog)mem[g.a]=0;
  }
  for(auto&[k,P]:per)if(P.state||P.bus||P.cyc||P.disputed)std::printf("  %s n=%u state=%u bus=%u cycles=%u disputed=%u\n",k.c_str(),P.total,P.state,P.bus,P.cyc,P.disputed);
  std::printf("SST65816_INTERP_CONFORMANCE cases=%zu state_fail=%u bus_order_fail=%u cycle_fail=%u disputed=%u\n",all.size(),tS,tB,tC,tD);
  return (tS||tB||tC)?1:0;
}
`;
function collect(){
  const st=fs.statSync(input);let groups=[];
  if(st.isDirectory()){for(const f of fs.readdirSync(input).filter(f=>/^[0-9a-f]{2}\.[en]\.json$/.test(f)).sort())groups.push(JSON.parse(fs.readFileSync(path.join(input,f),'utf8')).slice(0,per));}
  else groups.push(JSON.parse(input.endsWith('.gz')?require('zlib').gunzipSync(fs.readFileSync(input)).toString('utf8'):fs.readFileSync(input,'utf8')));
  return groups.flat();
}
const F=loadCoreInternals(corePath);
const romBytes=F.makeSyntheticRom();const rom=F.loadRom(romBytes,'sst65816.sfc');
const tests=collect();const fns=[],rows=[],skipped={};
for(const t of tests){
  const I=t.initial,mem=new Map(I.ram.map(([a,v])=>[a,v]));
  const st={emulation:!!I.e,m8:!!(I.e||(I.p&0x20)),x8:!!(I.e||(I.p&0x10)),carry:!!(I.p&1)};
  romBytes.fill(0xEA,0,8);romBytes.set([0,1,2,3].map(k=>mem.get((I.pbr<<16)|((I.pc+k)&0xFFFF))??0),0);
  const i=F.decodeOne(rom,0x008000,{...st});i.pc=(I.pbr<<16)|I.pc;i.stateIn={...st};
  if(i.mnemonic==='WAI'||i.mnemonic==='STP'){skipped[i.mnemonic]=(skipped[i.mnemonic]||0)+1;continue;}
  try{i.flowTarget=F.__flowTarget(i);}catch(e){i.flowTarget=null;}if(i.flowTarget===undefined)i.flowTarget=null;
  let vec;if(i.mnemonic==='BRK'||i.mnemonic==='COP'){vec=I.e?(i.mnemonic==='BRK'?0xFFFE:0xFFF4):(i.mnemonic==='BRK'?0xFFE6:0xFFE4);i.flowTarget=(mem.get(vec)??0)|((mem.get(vec+1)??0)<<8);}
  const id=fns.length;fns.push(id);
  const s=x=>`${x.pc} ${x.s} ${x.p} ${x.a} ${x.x} ${x.y} ${x.dbr} ${x.d} ${x.pbr} ${x.e}`;const r=x=>`${x.length} `+x.map(([a,v])=>`${a} ${v}`).join(' ');
  // The recompiler resolves BRK/COP vectors statically from ROM: vector pulls are not data accesses.
  const acc=t.cycles.filter(([a,v,f])=>v!==null&&f[0]==='d'&&f[1]!=='p');
  rows.push(`${id} ${t.name.replace(/ /g,'_')} ${i.mnemonic} ${i.mode} ${i.size} ${t.cycles.length}\n${s(I)}\n${s(t.final)}\n${r(I.ram)}\n${r(t.final.ram)}\n${acc.length} `+acc.map(([a,v,f])=>`${a} ${v} ${f[3]==='w'?1:0}`).join(' '));
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-sst65816-'));
try{
  const proj=F.generateProject(rom,F.analyze(rom,64));
  for(const [k,v] of Object.entries(proj))if(k.startsWith('src/')&&!/generated_|dispatch|native_hooks|main\.cpp/.test(k))fs.writeFileSync(path.join(dir,path.basename(k)),v);
  fs.writeFileSync(path.join(dir,'runtime.hpp'),flatRuntime(proj['src/runtime.hpp']));
  fs.writeFileSync(path.join(dir,'cases.txt'),rows.join('\n')+'\n');
  cp.execFileSync(process.execPath,[path.join(__dirname,'gen-cpu-interpreter.js'),path.join(dir,'interp.cpp'),'--core',corePath],{stdio:'inherit'});
  fs.writeFileSync(path.join(dir,'generated.hpp'),'#pragma once\n#include "runtime.hpp"\nvoid forja65_dispatch(CpuState&, SnesRuntime&, std::uint32_t, std::uint32_t);\nbool forja65_is_stack_return_target(std::uint32_t, SnesRuntime&);\nvoid forja65_wait(CpuState&, SnesRuntime&, std::uint32_t);\nstruct ForjaInterpreterHooks{void(*interpret)(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t,bool(*)(SnesRuntime&,std::uint32_t,const CpuState&));void(*report)(const char*);};\nextern ForjaInterpreterHooks forja65_interpreter_hooks;\n');
  fs.writeFileSync(path.join(dir,'sst.cpp'),'#define FORJA65_STACKLESS_CALLS 1\n#include "runtime.hpp"\nvoid forja65_wait(CpuState&,SnesRuntime&,std::uint32_t){}\nstruct ForjaInterpreterHooks{void(*interpret)(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t,bool(*)(SnesRuntime&,std::uint32_t,const CpuState&));void(*report)(const char*);};\nForjaInterpreterHooks forja65_interpreter_hooks{};\n'+HARNESS+
    `\nint main(int argc,char**argv){return sstRun(${fns.length},argc>1?argv[1]:"cases.txt",argc>2);}\n`);
  const exe=path.join(dir,process.platform==='win32'?'sst.exe':'sst');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-w','-DFORJA65_STACKLESS_CALLS=1','-I'+dir,path.join(dir,'sst.cpp'),path.join(dir,'interp.cpp'),'-o',exe],{cwd:dir,stdio:'inherit',timeout:1800000});
  const res=cp.spawnSync(exe,[path.join(dir,'cases.txt')].concat(process.env.FORJA65_SST_VERBOSE?['-v']:[]),{cwd:dir,encoding:'utf8',maxBuffer:1<<26});
  process.stdout.write(res.stdout||'');process.stderr.write(res.stderr||'');
  const m=/SST65816_INTERP_CONFORMANCE cases=(\d+) state_fail=(\d+) bus_order_fail=(\d+) cycle_fail=(\d+) disputed=(\d+)/.exec(res.stdout||'');
  if(!m)throw new Error('saida do harness ausente');
  const summary={cases:+m[1],state_fail:+m[2],bus_order_fail:+m[3],cycle_fail:+m[4],disputed:+m[5],skipped};
  console.log(JSON.stringify(summary));
  if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(summary,null,1));
  process.exitCode=res.status;
}finally{if(!process.env.FORJA65_SST_KEEP)fs.rmSync(dir,{recursive:true,force:true});else console.log('mantido: '+dir);}
