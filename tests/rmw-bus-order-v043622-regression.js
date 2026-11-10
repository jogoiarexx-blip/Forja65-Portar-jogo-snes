'use strict';
// A reversed RMW word store must fail on bus order and on WRAM-port effects.
// The ares CPU bodies form the oracle; peripheral runtime is deliberately shared.
const C=require(process.env.FORJA_TEST_CORE||'../forja65-core');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const probeTimeout=Number(process.env.FORJA65_NATIVE_TEST_TIMEOUT_MS||180000);assert(Number.isFinite(probeTimeout)&&probeTimeout>0,'invalid native test timeout');
const r=C.loadRom(C.makeSyntheticRom());r.data[0]=0xdb;
const specs=[],entries=[];
const opcodes=[[0xee,0xfe,0xe6,0xf6],[0xce,0xde,0xc6,0xd6],[0x0e,0x1e,0x06,0x16],[0x4e,0x5e,0x46,0x56],[0x2e,0x3e,0x26,0x36],[0x6e,0x7e,0x66,0x76],[0x0c,null,0x04,null],[0x1c,null,0x14,null]];
function add(op,kind,operand,opcode,port=false,store=false){
 const pc=0x8100+specs.length*0x10,size=kind<2?3:2;
 r.data.set([opcode,operand&255,...(size===3?[operand>>>8]:[]),0xdb],pc-0x8000);
 specs.push({pc,op,kind,operand,opcode,port,store});
 for(const emulation of [false,true])for(const m8 of [false,true])for(const x8 of [false,true])if(!emulation||(m8&&x8))entries.push({address:pc,state:{emulation,m8,x8,carry:null}});
}
for(let op=0;op<8;op++)add(op,0,0x2180,opcodes[op][0],true);
for(let op=0;op<8;op++)for(let kind=0;kind<4;kind++)if(opcodes[op][kind]!==null)add(op,kind,[0x1000,0x0fe0,0x80,0x70][kind],opcodes[op][kind]);
add(0,0,0x2180,0x8d,true,true);add(0,0,0x1000,0x8d,false,true);add(0,2,0x80,0x85,false,true);
const p=C.generateProject(r,C.analyze(r,1024,[],{knowledge:{schema:'forja65.knowledge.v1',entries}}));
// REV141: test-only snapshot at the next STP boundary preserves the original
// RMW-body MDR assertion even though STP itself now drives its opcode onto MDR.
p['src/runtime.hpp']=p['src/runtime.hpp'].replace('struct SnesRuntime {','struct SnesRuntime {\n std::uint8_t testRmwMdrBeforeStop{};bool testRmwMdrCaptured{};').replace('  void traceInstruction(std::uint32_t pc,const CpuState& cpu,unsigned opcode=256u){','  void traceInstruction(std::uint32_t pc,const CpuState& cpu,unsigned opcode=256u){if(opcode==0xdbu){testRmwMdrBeforeStop=cpuDataBus;testRmwMdrCaptured=true;}');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rmw-'));
try{
 for(const[n,v]of Object.entries(p))if(n.startsWith('src/')||n==='assets/cart-data.bin'){const f=path.join(dir,n);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
 fs.copyFileSync(path.join(__dirname,'reference/ares_rmw_reference_v043622.hpp'),path.join(dir,'src/ares_rmw_reference_v043622.hpp'));
 fs.copyFileSync(path.join(__dirname,'fixtures/rmw_bus_order_v043622.cpp'),path.join(dir,'probe.cpp'));
 fs.writeFileSync(path.join(dir,'src/rmw_cases.hpp'),'struct TestProgram {unsigned pc,op,kind,operand,opcode;bool port,store;};\nstatic const TestProgram programs[]={\n'+specs.map(s=>'{'+[s.pc,s.op,s.kind,s.operand,s.opcode,s.port,s.store].join(',')+'}').join(',\n')+'\n};\n');
 const sources=Object.keys(p).filter(n=>/^src\/generated_.*\.cpp$/.test(n)||n==='src/dispatch.cpp'||n==='src/native_hooks.cpp');
 // Compile the unchanged generated units together to avoid parsing runtime.hpp 64 times.
 fs.writeFileSync(path.join(dir,'generated-unity.cpp'),sources.map(n=>'#include '+JSON.stringify(n)).join('\n')+'\n');
 const args=['-std=c++20','-O0','-Isrc','probe.cpp','generated-unity.cpp','-o','probe'];if(process.platform==='win32')args.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-Isrc','-fsyntax-only','probe.cpp'],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(process.env.CXX||'g++',args,{cwd:dir,stdio:'inherit'});
 const q=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8',timeout:probeTimeout,env:{...process.env,FORJA65_HEADLESS_FRAMES:'0'}});
 if(q.error)process.stderr.write(q.error.message+'\n');
 process.stdout.write(q.stdout||'');process.stderr.write(q.stderr||'');
 if(process.env.FORJA_TEST_OUTPUT_DIR){fs.mkdirSync(process.env.FORJA_TEST_OUTPUT_DIR,{recursive:true});for(const[n,target]of [['rmw-results.json','rmw-results.json'],['assets/cart-data.bin','rmw-synthetic.sfc'],['first-rmw-native.csv','first-rmw-native.csv'],['first-rmw-reference.csv','first-rmw-reference.csv']])fs.copyFileSync(path.join(dir,n),path.join(process.env.FORJA_TEST_OUTPUT_DIR,target));}
 assert.equal(q.status,0,'RMW final stores, CPU flags, WRAM and port address must match the CPU reference; STA must keep low/high order');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
