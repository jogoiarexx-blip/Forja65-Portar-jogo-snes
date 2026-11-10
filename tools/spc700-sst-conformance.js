#!/usr/bin/env node
'use strict';
// Forja65 REV132 — SPC700 conformance against SingleStepTests/spc700 (one instruction per vector).
// Checks (1) the runtime SPC700 interpreter (forja65SpcStep) in the historical and corrected
// semantic sets and in the complete reference profile, and (2) the SPC AOT recompiler (spcCpp)
// for every opcode it supports. Vectors touching $00F0-$00FF or the IPL window are skipped
// because the test suite models flat RAM there, while the S-SMP maps I/O registers.
// Usage: node tools/spc700-sst-conformance.js <SingleStepTests/spc700/v1 dir | fixture.json[.gz]> [--per N] [--core path]
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),zlib=require('zlib');
function arg(n,d){const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;}
const input=process.argv[2];if(!input){console.error('uso: node tools/spc700-sst-conformance.js <dir|fixture.json[.gz]>');process.exit(2);}
const corePath=path.resolve(arg('--core',path.join(__dirname,'..','forja65-core.js')));const per=+arg('--per','1000');
const F=require(corePath);
let tests=[];
if(fs.statSync(input).isDirectory()){for(const f of fs.readdirSync(input).filter(f=>/^[0-9a-f]{2}\.json$/.test(f)).sort())tests.push(...JSON.parse(fs.readFileSync(path.join(input,f),'utf8')).slice(0,per));}
else tests=JSON.parse(input.endsWith('.gz')?zlib.gunzipSync(fs.readFileSync(input)).toString('utf8'):fs.readFileSync(input,'utf8'));
const io=t=>t.cycles.some(c=>c[0]!==null&&((c[0]>=0xF0&&c[0]<=0xFF)||c[0]>=0xFFC0));
const usable=tests.filter(t=>!io(t));
const st=s=>`${s.pc} ${s.a} ${s.x} ${s.y} ${s.sp} ${s.psw} ${s.ram.length} `+s.ram.map(([a,v])=>`${a} ${v}`).join(' ');
const rows=usable.map(t=>`T ${t.name.slice(0,2)} ${t.cycles.length}\n${st(t.initial)}\n${st(t.final)}`);
// AOT programs: one translated function per supported vector.
let header=null;const progs=[],aotRows=[];
for(const t of usable){
  const data=new Uint8Array(65536);for(const [a,v] of t.initial.ram)data[a]=v;const cap={data,manifest:{},entry:t.initial.pc};
  const d=F.spcDecodeOne(cap,t.initial.pc);if(d.status!=='native')continue;
  let src=F.spcCpp(cap,F.spcAnalyze(cap,1));const start=src.indexOf('void forja65_spc_run_slice');if(header===null)header=src.slice(0,start);
  let fn=src.slice(start,src.includes('int forja65_native_spc_instruction')?src.indexOf('int forja65_native_spc_instruction'):src.indexOf('void forja65_native_spc_tick')).replace('void forja65_spc_run_slice','static void P'+progs.length);
  const defined=new Set([...fn.matchAll(/\b(S_[0-9A-F]{4}):/g)].map(m=>m[1]));let extra='';
  for(const u of new Set([...fn.matchAll(/goto (S_[0-9A-F]{4});/g)].map(m=>m[1])))if(!defined.has(u))extra+=`${u}:\n  cpu.pc=0x${u.slice(2)}u; return;\n`;
  fn=fn.replace(/\}\s*$/,extra+'}\n').replace('default: throw std::runtime_error("SPC700 destino dinamico nao recompilado");','default: return;');
  aotRows.push(`A ${progs.length} ${t.name.slice(0,2)} ${d.mnemonic} ${t.cycles.length}\n${st(t.initial)}\n${st(t.final)}`);progs.push(fn);
}
const cpp=header+String.raw`
#include <cstdio>
#include <fstream>
#include <map>
#include <memory>
struct St{unsigned pc,a,x,y,sp,psw;std::vector<std::pair<unsigned,unsigned>>ram;};
static bool rd(std::istream&in,St&s){size_t n;if(!(in>>s.pc>>s.a>>s.x>>s.y>>s.sp>>s.psw>>n))return false;s.ram.resize(n);for(auto&p:s.ram)in>>p.first>>p.second;return true;}
`+progs.join('\n')+String.raw`
static void(*const AOT[])(SpcCpuState&,ApuBridge&,unsigned)={${progs.length?progs.map((_,k)=>'P'+k).join(','):'nullptr'}};
int main(int argc,char**argv){
  struct Prof{const char*name;bool sem,timing;};const Prof profs[3]={{"legacy",false,false},{"corrected_semantics",true,false},{"reference",true,true}};
  int status=0;
  for(const auto&pf:profs){std::ifstream in(argv[1]);std::string T,op;unsigned cyc;unsigned total=0,bad=0,badCyc=0;std::map<std::string,unsigned> badOps;
    auto b=std::make_unique<ApuBridge>();b->correctedSpcSemantics=pf.sem;b->accurateSpcTiming=b->strictSpcScheduler=b->ntscSpcClock=pf.timing;
    while(in>>T>>op>>cyc){St i,f;rd(in,i);rd(in,f);auto&s=b->spc;std::fill(s.ram.begin(),s.ram.end(),0);s.control=0;s.test=0x0A;s.sleeping=s.stopped=false;
      for(auto&p:i.ram)s.ram[p.first]=p.second;s.pc=i.pc;s.setA(i.a);s.x=i.x;s.setY(i.y);s.sp=i.sp;s.psw=i.psw;
      const int c=forja65SpcStep(*b);bool ok=s.pc==f.pc&&s.a()==f.a&&s.x==f.x&&s.y()==f.y&&s.sp==f.sp&&s.psw==f.psw;for(auto&p:f.ram)if(s.ram[p.first]!=p.second)ok=false;
      total++;if(!ok){bad++;badOps[op]++;}
      // SLEEP/STOP halt the core; the suite keeps counting idle cycles after the halt.
      if(c!=int(cyc)&&op!="ef"&&op!="ff"&&op!="EF"&&op!="FF")badCyc++;}
    std::printf("SPC700_INTERPRETER profile=%s vectors=%u state_fail=%u cycle_fail=%u opcodes_with_state_fail=%zu\n",pf.name,total,bad,badCyc,badOps.size());
    if(pf.sem&&bad)status=1;if(pf.timing&&badCyc)status=1;}
  {std::ifstream in(argv[2]);std::string A,op,mn;unsigned id,expectedCycles;unsigned total=0,bad=0,badCycles=0;std::map<std::string,unsigned> ops;auto apu=std::make_unique<ApuBridge>();apu->spc.control=0;apu->accurateSpcTiming=true;apu->correctedSpcSemantics=true;
    while(in>>A>>id>>op>>mn>>expectedCycles){St i,f;rd(in,i);rd(in,f);auto&r=apu->spc.ram;std::fill(r.begin(),r.end(),0);for(auto&p:i.ram)r[p.first]=p.second;
      SpcCpuState s;s.pc=i.pc;s.a=i.a;s.x=i.x;s.y=i.y;s.sp=i.sp;unpack(s,i.psw);const auto before=apu->spcExecutedCycles;AOT[id](s,*apu,2u);if(!s.stopped&&!s.sleeping&&apu->spcExecutedCycles-before!=expectedCycles)badCycles++;
      bool ok=s.pc==f.pc&&s.a==f.a&&s.x==f.x&&s.y==f.y&&s.sp==f.sp&&pack(s)==f.psw;for(auto&p:f.ram)if(r[p.first]!=p.second)ok=false;total++;ops[op]++;if(!ok)bad++;}
    std::printf("SPC700_AOT vectors=%u opcodes=%zu state_fail=%u cycle_fail=%u\n",total,ops.size(),bad,badCycles);if(bad||badCycles)status=1;}
  return status;}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-sst-spc700-'));
try{
  const rom=F.loadRom(F.makeSyntheticRom(),'spc.sfc');const proj=F.generateProject(rom,F.analyze(rom,32));
  for(const k of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,k),proj['src/'+k]);
  fs.writeFileSync(path.join(dir,'interp.txt'),rows.join('\n')+'\n');fs.writeFileSync(path.join(dir,'aot.txt'),aotRows.join('\n')+'\n');
  fs.writeFileSync(path.join(dir,'spc.cpp'),cpp);const exe=path.join(dir,process.platform==='win32'?'spc.exe':'spc');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-w','-I'+dir,path.join(dir,'spc.cpp'),'-o',exe],{cwd:dir,stdio:'inherit',timeout:1800000});
  const r=cp.spawnSync(exe,[path.join(dir,'interp.txt'),path.join(dir,'aot.txt')],{cwd:dir,encoding:'utf8'});
  process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
  console.log(JSON.stringify({vectors_total:tests.length,vectors_without_io:usable.length,aot_vectors:aotRows.length}));
  process.exitCode=r.status;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
