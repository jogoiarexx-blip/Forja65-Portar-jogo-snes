'use strict';
// A redirected real RTS consumes its hardware call frame. Its host bookkeeping
// must be retired too; otherwise repeated scripts grow it without bound.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const C=require('../forja65-core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-return-lifetime-'));
try {
 for(const native of [false,true])for(const longCall of [false,true]){
  const data=C.makeSyntheticRom();
  const call=longCall?[0x22,0x00,0x82,0x00]:[0x20,0x00,0x82];
  data.set([...(native?[0x18,0xFB,0xC2,0x30]:[]),...call,0xDB],0);
  const body=longCall?(native?[0x68,0xE2,0x20,0x68,0xA9,0x00,0x48,0xA9,0x80,0x48,0xA9,0x1F,0x48,0xC2,0x20,0x6B]:[0x68,0x68,0x68,0xA9,0x00,0x48,0xA9,0x80,0x48,0xA9,0x1F,0x48,0x6B]):(native?[0x68,0xA9,0x1F,0x80,0x48,0x60]:[0x68,0x68,0xA9,0x80,0x48,0xA9,0x1F,0x48,0x60]);
  data.set(body,0x200);
  data.set([0x85,0x10,0xDB],0x20);
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
h.cart[0x20]=0x85;h.cart[0x21]=0x10;h.cart[0x22]=0xDB;
for(int k=0;k<1000;k++){CpuState c;c.enforceEmulation();h.stopped=false;forja65_dispatch(c,h,0x008000,0);if(c.s!=0x1ff||h.ram[0x10]!=0x1f){std::cerr<<"hardware return/state changed";return 2;}}
if(!h.nativeReturns.empty()){std::cerr<<"stale redirected call frames="<<h.nativeReturns.size()<<"\\n";return 3;}
std::cout<<"redirected RTS/RTL lifetime PASS\\n";}
`);
  const sources=fs.readdirSync(path.join(out,'src')).filter(n=>/^generated_.*cpp$/.test(n)||n==='dispatch.cpp').map(n=>path.join(out,'src',n));
  cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-I',path.join(out,'src'),path.join(out,'test.cpp'),...sources,'-o',path.join(out,'test')],{stdio:'inherit'});
  const run=cp.spawnSync(path.join(out,'test'),[],{cwd:out,encoding:'utf8'});
  process.stdout.write(run.stdout);process.stderr.write(run.stderr);
  assert.equal(run.status,0,(native?'Native':'Emulation')+' redirected RTS must retire consumed hardware call frames');
 }
 console.log('STACK_RETURN_LIFETIME_V0393_PASS emulation/native RTS/RTL 1000 redirected calls each');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
