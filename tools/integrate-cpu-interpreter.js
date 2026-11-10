#!/usr/bin/env node
'use strict';
// Forja65 REV133 — integra o interpretador 65C816 de fallback em um port ja gerado.
//
// O que faz (idempotente; cada passo so e aplicado se ainda faltar):
//  1. gera src/forja_cpu_interpreter.cpp com tools/gen-cpu-interpreter.js;
//  2. runtime.hpp: acrescenta a API usada pelo emissor REV132+ que ports antigos nao tem
//     (readW/write com bank0, readRmw/writeRmw, RMW com bank0, dropStack, finishFullStackInstruction).
//     As versoes antigas continuam intactas: o codigo AOT existente nao muda de comportamento;
//  3. dispatch.cpp: quando nao existe rotina AOT (CFG) ou variante M/X/E/C para o destino, o
//     dispatcher passa a interpretar em vez de abortar; retornos RTS/RTL para enderecos executaveis
//     sem frame nativo passam a ser aceitos (o frame fisico da pilha e consumido normalmente);
//  4. generated.hpp, CMakeLists.txt e main.cpp (relatorio forja65-cpu-interpreter.txt ao sair);
//  5. REV134: modo de controle remoto FORJA65_CONTROL=1 (savestates por fork) no runtime.hpp.
//
// FORJA65_CPU_INTERPRETER=0 desliga o fallback em tempo de execucao (comportamento antigo: aborta).
//
// Uso: node tools/integrate-cpu-interpreter.js <pasta-do-port> [--core forja65-core.js] [--dry-run]
const fs=require('fs'),path=require('path'),cp=require('child_process');
function arg(n,d){const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;}
const port=process.argv[2];
if(!port||!fs.existsSync(path.join(port,'src','dispatch.cpp'))){console.error('uso: node tools/integrate-cpu-interpreter.js <pasta-do-port>  (precisa de src/dispatch.cpp)');process.exit(2);}
const dry=process.argv.includes('--dry-run');
const core=path.resolve(arg('--core',path.join(__dirname,'..','forja65-core.js')));
const src=f=>path.join(port,'src',f);
const report=[];
function patchFile(file,fn){const p=file;const before=fs.readFileSync(p,'utf8');const after=fn(before);if(after!==before){if(!dry)fs.writeFileSync(p,after);return true;}return false;}
function must(text,anchor,what){if(!text.includes(anchor))throw new Error(`ancora ausente (${what}): ${anchor.slice(0,90)}`);}

// 2) runtime: API estendida
const changedRt=patchFile(src('runtime.hpp'),t=>{
  if(!t.includes('std::uint32_t readW(std::uint32_t a,int w,bool bank0')){
    const a='void write(std::uint32_t a,std::uint32_t v,int w){';must(t,a,'SnesRuntime::write');
    const i=t.indexOf(a);let end=i+a.length,depth=1;while(depth>0&&end<t.length){const ch=t[end++];if(ch==='{')depth++;else if(ch==='}')depth--;}
    t=t.slice(0,end)+`
  // REV133: API do emissor REV132+ (bank0 = enderecamento direto que da a volta no banco 0).
  std::uint32_t readW(std::uint32_t a,int w,bool bank0){std::uint32_t v=read(a);if(w==16){const auto high=bank0?((a+1u)&0xFFFFu):((a+1u)&0xFFFFFFu);v|=read(high)<<8;}return v;}
  void write(std::uint32_t a,std::uint32_t v,int w,bool bank0){write8(a,(std::uint8_t)(v&0xFF));if(w==16)write8(bank0?((a+1u)&0xFFFFu):((a+1u)&0xFFFFFFu),(std::uint8_t)((v>>8)&0xFF));}
  std::uint32_t readRmw(std::uint32_t a,int w,bool bank0=false){return readW(a,w,bank0);}
  void writeRmw(std::uint32_t a,std::uint32_t v,int w,bool bank0=false){if(w==16)write8(bank0?((a+1u)&0xFFFFu):((a+1u)&0xFFFFFFu),(std::uint8_t)((v>>8)&0xFFu));write8(a,(std::uint8_t)(v&0xFFu));}
  // O ciclo de modificacao do RMW e interno (ares CPU::idle); ja contado na instrucao.
  void rmwIntermediate(std::uint32_t,std::uint32_t,int,bool){}
`+t.slice(end);
  }
  if(!t.includes('void dropStack(')){
    const a='struct CpuState {';must(t,a,'CpuState');
    t=t.replace(a,a+`
  // REV133: API do emissor REV132+.
  void finishFullStackInstruction(){if(e)s=(std::uint16_t)(0x100u|(s&0xFFu));}
  void dropStack(unsigned n,bool full=false){for(unsigned k=0;k<n;k++)s=(full||!e)?(std::uint16_t)(s+1):(std::uint16_t)(0x100u|((s+1)&0xFFu));if(full)finishFullStackInstruction();}
  void incMem(SnesRuntime&,std::uint32_t,int,bool); void decMem(SnesRuntime&,std::uint32_t,int,bool); void aslMem(SnesRuntime&,std::uint32_t,int,bool); void lsrMem(SnesRuntime&,std::uint32_t,int,bool); void rolMem(SnesRuntime&,std::uint32_t,int,bool); void rorMem(SnesRuntime&,std::uint32_t,int,bool); void tsb(SnesRuntime&,std::uint32_t,int,bool); void trb(SnesRuntime&,std::uint32_t,int,bool);`);
    t=t.replace(/\s*$/,'')+`
// REV133: RMW com bank0 (mesma semantica do runtime REV132).
inline void CpuState::incMem(SnesRuntime& hw,std::uint32_t addr,int w,bool bank0){std::uint32_t mask=w==8?0xFF:0xFFFF,old=hw.readRmw(addr,w,bank0)&mask;hw.rmwIntermediate(addr,old,w,e);std::uint32_t v=(old+1)&mask;hw.writeRmw(addr,v,w,bank0);nz((std::uint16_t)v,w);}
inline void CpuState::decMem(SnesRuntime& hw,std::uint32_t addr,int w,bool bank0){std::uint32_t mask=w==8?0xFF:0xFFFF,old=hw.readRmw(addr,w,bank0)&mask;hw.rmwIntermediate(addr,old,w,e);std::uint32_t v=(old-1)&mask;hw.writeRmw(addr,v,w,bank0);nz((std::uint16_t)v,w);}
inline void CpuState::aslMem(SnesRuntime& hw,std::uint32_t addr,int w,bool bank0){std::uint32_t mask=w==8?0xFF:0xFFFF,sign=w==8?0x80:0x8000,old=hw.readRmw(addr,w,bank0)&mask;hw.rmwIntermediate(addr,old,w,e);c=(old&sign)!=0;std::uint32_t r=(old<<1)&mask;hw.writeRmw(addr,r,w,bank0);nz((std::uint16_t)r,w);}
inline void CpuState::lsrMem(SnesRuntime& hw,std::uint32_t addr,int w,bool bank0){std::uint32_t mask=w==8?0xFF:0xFFFF,old=hw.readRmw(addr,w,bank0)&mask;hw.rmwIntermediate(addr,old,w,e);c=(old&1u)!=0;std::uint32_t r=(old>>1)&mask;hw.writeRmw(addr,r,w,bank0);nz((std::uint16_t)r,w);}
inline void CpuState::rolMem(SnesRuntime& hw,std::uint32_t addr,int w,bool bank0){std::uint32_t mask=w==8?0xFF:0xFFFF,sign=w==8?0x80:0x8000,old=hw.readRmw(addr,w,bank0)&mask,r=((old<<1)|(c?1u:0u))&mask;hw.rmwIntermediate(addr,old,w,e);c=(old&sign)!=0;hw.writeRmw(addr,r,w,bank0);nz((std::uint16_t)r,w);}
inline void CpuState::rorMem(SnesRuntime& hw,std::uint32_t addr,int w,bool bank0){std::uint32_t mask=w==8?0xFF:0xFFFF,sign=w==8?0x80:0x8000,old=hw.readRmw(addr,w,bank0)&mask,r=((old>>1)|(c?sign:0u))&mask;hw.rmwIntermediate(addr,old,w,e);c=(old&1u)!=0;hw.writeRmw(addr,r,w,bank0);nz((std::uint16_t)r,w);}
inline void CpuState::tsb(SnesRuntime& hw,std::uint32_t addr,int w,bool bank0){std::uint32_t mask=w==8?0xFF:0xFFFF,mem=hw.readRmw(addr,w,bank0)&mask,av=a&mask;hw.rmwIntermediate(addr,mem,w,e);z=(mem&av)==0;hw.writeRmw(addr,mem|av,w,bank0);}
inline void CpuState::trb(SnesRuntime& hw,std::uint32_t addr,int w,bool bank0){std::uint32_t mask=w==8?0xFF:0xFFFF,mem=hw.readRmw(addr,w,bank0)&mask,av=a&mask;hw.rmwIntermediate(addr,mem,w,e);z=(mem&av)==0;hw.writeRmw(addr,mem&(~av&mask),w,bank0);}
`;
  }
  return t;
});
if(changedRt)report.push('runtime.hpp: API REV132 acrescentada (versoes antigas preservadas)');

// 1+3+4) interpretador, dispatcher, declaracoes, CMake e main: mesma rotina usada na geracao de projetos novos
const F=require(core);
const names=['src/dispatch.cpp','src/generated.hpp','src/main.cpp','CMakeLists.txt','src/forja_cpu_interpreter.cpp','src/runtime.hpp'].concat(fs.readdirSync(path.join(port,'src')).filter(f=>f.endsWith('.cpp')&&f!=='dispatch.cpp'&&f!=='forja_cpu_interpreter.cpp').map(f=>'src/'+f));
const files={};for(const n of names){const p=path.join(port,n);if(fs.existsSync(p))files[n]=fs.readFileSync(p,'utf8');}
const before=JSON.stringify(files);F.attachCpuInterpreter(files);if(F.attachRuntimeControl)F.attachRuntimeControl(files);if(F.attachLargeStack)F.attachLargeStack(files);if(F.attachDsp1)F.attachDsp1(files);if(F.attachVCounterFix)F.attachVCounterFix(files);if(F.attachTraceEnv)F.attachTraceEnv(files);if(F.attachDispatchUnwind)F.attachDispatchUnwind(files);
if(files['src/main.cpp']&&!files['src/main.cpp'].includes('static void forja65Fatal(const char*msg){forja65_interpreter_report'))files['src/main.cpp']=files['src/main.cpp'].replace('static void forja65Fatal(const char*msg){','static void forja65Fatal(const char*msg){forja65_interpreter_report("forja65-cpu-interpreter.txt");');
let written=0;if(!dry){for(const [n,v] of Object.entries(files)){const p=path.join(port,n);if(!fs.existsSync(p)||fs.readFileSync(p,'utf8')!==v){fs.writeFileSync(p,v);written++;}}}report.push(`arquivos alterados: ${written}`);
report.push(JSON.stringify(files)!==before?'dispatcher/interpretador/CMake/main integrados (attachCpuInterpreter)':'ja integrado: dispatcher sem alteracao');
console.log((dry?'[dry-run] ':'')+report.join('\n'));
