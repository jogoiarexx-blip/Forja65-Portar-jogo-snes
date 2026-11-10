'use strict';
// A redirected real RTS consumes its hardware call frame. Its host bookkeeping
// must be retired too; otherwise repeated scripts grow it without bound.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const C=require('../forja65-core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-return-lifetime-'));
try {
 for(const native of [true])for(const longCall of [false]){
  const data=C.makeSyntheticRom();
  const call=longCall?[0x22,0x00,0x82,0x00]:[0x20,0x00,0x82];
  data.set([...(native?[0x18,0xFB,0xC2,0x30]:[]),...call,0xDB],0);
  const body=longCall?(native?[0x68,0xE2,0x20,0x68,0xA9,0x00,0x48,0xA9,0x80,0x48,0xA9,0x1F,0x48,0xC2,0x20,0x6B]:[0x68,0x68,0x68,0xA9,0x00,0x48,0xA9,0x80,0x48,0xA9,0x1F,0x48,0x6B]):(native?[0x68,0xA9,0x1F,0x80,0x48,0x60]:[0x68,0x68,0xA9,0x80,0x48,0xA9,0x1F,0x48,0x60]);
  data.set(body,0x200);
  data.set([0xE6,0x10,0xA5,0x10,0xC9,0x60,0xEA,0xD0,0xDB,0xDB],0x20);
  const rom=C.loadRom(data,'redirected-return.sfc');
  const a=C.analyze(rom,256,`target=008020 from=008205 kind=STACK-RTS e=${native?0:1} m=${native?0:1} x=${native?0:1} c=${native?1:0}`);
  a.syntheticReturnTargets=[0x008020];
  const files=C.generateProject(rom,a),out=path.join(dir,(native?'native':'emulation')+(longCall?'-rtl':'-rts'));
  for(const [n,v] of Object.entries(files))if(n.startsWith('src/')){fs.mkdirSync(path.dirname(path.join(out,n)),{recursive:true});fs.writeFileSync(path.join(out,n),v);}
  fs.writeFileSync(path.join(out,'test.cpp'),`#include "generated.hpp"
#include <iostream>
int main(){SnesRuntime h;h.cart.resize(${data.length});h.romLogicalSize=h.cart.size();
${Array.from(data.slice(0,9)).map((v,i)=>`h.cart[${i}]=${v};`).join('')}
${Array.from(data.slice(0x200,0x200+body.length)).map((v,i)=>`h.cart[${0x200+i}]=${v};`).join('')}
${Array.from(data.slice(0x20,0x2a)).map((v,i)=>`h.cart[${0x20+i}]=${v};`).join('')}
CpuState c;c.enforceEmulation();forja65_dispatch(c,h,0x008000,0);
if(c.s!=0x1ff||h.ram[0x10]!=0x60||h.ram[0x11]!=0xea)return 2;
if(!h.nativeReturns.empty()){std::cerr<<"stale redirected call frames="<<h.nativeReturns.size()<<"\\n";return 3;}
std::cout<<"redirected RTS/RTL lifetime PASS\\n";}
`);
  const sources=fs.readdirSync(path.join(out,'src')).filter(n=>/^generated_.*cpp$/.test(n)||n==='dispatch.cpp').map(n=>path.join(out,'src',n));
  cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-DFORJA65_STACKLESS_CALLS=1','-I',path.join(out,'src'),path.join(out,'test.cpp'),...sources,'-o',path.join(out,'test')],{stdio:'inherit'});
  const run=cp.spawnSync(path.join(out,'test'),[],{cwd:out,encoding:'utf8',env:{...process.env,FORJA65_HEADLESS_FRAMES:'0'}});
  process.stdout.write(run.stdout);process.stderr.write(run.stderr);
  assert.equal(run.status,0,(native?'Native':'Emulation')+' redirected RTS must retire consumed hardware call frames');
 }
 console.log('STACKLESS_CONTINUOUS_REDIRECT_PASS 60000 coroutine returns in one dispatch');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
