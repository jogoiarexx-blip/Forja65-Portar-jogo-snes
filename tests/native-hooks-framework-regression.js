const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');const C=require('../forja65-core.js');
const data=C.makeSyntheticRom();data.set([0x20,0x20,0x80,0x22,0x30,0x80,0x80,0xdb],0); // JSR; JSL (mirror); STP
// short: LDA #$12; STA $10; RTS. long: LDA #$34; STA $11; RTL.
data.set([0xa9,0x12,0x85,0x10,0x60],0x20);data.set([0xa9,0x34,0x85,0x11,0x6b],0x30);
const rom=C.loadRom(data),a=C.analyze(rom,256),files=C.generateProject(rom,a);
assert.ok(files['src/runtime.hpp'].includes('registerNativeHook'),'hook API missing');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-framework-'));for(const[n,v]of Object.entries(files)){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
fs.writeFileSync(path.join(dir,'hook_test.cpp'),String.raw`#include "src/generated.hpp"
#include <cassert>
#include <iostream>
static unsigned shortBody(CpuState&c,SnesRuntime&h){c.setA(0x12,8);h.ram[0x10]=0x12;return 82;}
static unsigned longBody(CpuState&c,SnesRuntime&h){c.setA(0x34,8);h.ram[0x11]=0x34;return 84;}
static unsigned corrupt(CpuState&c,SnesRuntime&h){h.write8((c.s+1)&0xffff,0xaa);return 1;}
static bool reject(const CpuState&,const SnesRuntime&){return false;}
int main(){
 SnesRuntime ref("assets/cart-data.bin",MapperKind::LoROM,0,0,0,CartChip::None,"ref.srm",1,true);CpuState rc;
 ref.nativeReference=true;ref.registerNativeHook({0x8020,shortBody,nullptr,1,1,1});forja65_dispatch(rc,ref,0x8000,0xffffff);
 SnesRuntime host("assets/cart-data.bin",MapperKind::LoROM,0,0,0,CartChip::None,"host.srm",1,true);CpuState hc;
 host.trace.start("native.csv",host.cartHashHex());host.registerNativeHook({0x8020,shortBody,nullptr,1,1,1});host.registerNativeHook({0x8030,longBody,nullptr,1,1,1});forja65_dispatch(hc,host,0x8000,0xffffff);host.trace.close();
 assert(ref.cpuInstructionCount==9&&host.cpuInstructionCount==3);assert(host.cpuMasterClock==ref.cpuMasterClock);assert(host.apu.spc.pc==ref.apu.spc.pc);assert(host.ram==ref.ram);assert(hc.a==rc.a&&hc.x==rc.x&&hc.s==rc.s&&hc.pb==rc.pb&&hc.packP()==rc.packP());assert(host.nativeReturns.empty());assert(host.nativeHookCalls==2);assert(ref.nativeHookCalls==0);
 SnesRuntime guarded("assets/cart-data.bin",MapperKind::LoROM,0,0,0,CartChip::None,"guard.srm",1,true);CpuState gc;guarded.registerNativeHook({0x8020,shortBody,reject,1,1,1});forja65_dispatch(gc,guarded,0x8000,0xffffff);assert(guarded.ram==ref.ram&&guarded.nativeHookCalls==0);
 SnesRuntime wrongState("assets/cart-data.bin",MapperKind::LoROM,0,0,0,CartChip::None,"state.srm",1,true);CpuState sc;wrongState.registerNativeHook({0x8020,shortBody,nullptr,0,1,1});forja65_dispatch(sc,wrongState,0x8000,0xffffff);assert(wrongState.nativeHookCalls==0);
 SnesRuntime relocated("assets/cart-data.bin",MapperKind::LoROM);CpuState lc;lc.push16Value(relocated,0x8002);relocated.pushNativeReturn(0x8003,false);relocated.registerNativeHook({0x8020,shortBody,nullptr,1,1,1});assert(!relocated.runNativeHook(0x400020,lc)&&relocated.nativeHookCalls==0&&relocated.ram[0x10]==0);
 SnesRuntime badStack("assets/cart-data.bin",MapperKind::LoROM,0,0,0,CartChip::None,"bad.srm",1,true);CpuState bc;badStack.registerNativeHook({0x8020,corrupt,nullptr,1,1,1});bool rejectedStack=false;try{forja65_dispatch(bc,badStack,0x8000,0xffffff);}catch(const std::runtime_error&){rejectedStack=true;}assert(rejectedStack&&badStack.nativeHookCalls==0);
 ForjaRenderer renderer;ForjaIR::setPalette(3,{0x001f,0x03e0}).apply(renderer);ForjaIR::setScroll(1,-7,14).apply(renderer);assert(renderer.palette[3]==0x1f&&renderer.layers[1].x==-7);try{ForjaIR::setPalette(255,{1,2}).apply(renderer);assert(false);}catch(const std::out_of_range&){}
 std::cout<<"reference_instructions="<<ref.cpuInstructionCount<<" host_instructions="<<host.cpuInstructionCount<<" host_calls="<<host.nativeHookCalls<<" reference_clocks="<<ref.cpuMasterClock<<" host_clocks="<<host.cpuMasterClock<<" ram_equal=YES stack_equal=YES\n";
}`);
const units=Object.keys(files).filter(n=>/^src\/generated_.*\.cpp$/.test(n));cp.execFileSync('g++',['-std=c++20','-O0','-I'+path.join(dir,'src'),path.join(dir,'hook_test.cpp'),path.join(dir,'src/dispatch.cpp'),...units.map(n=>path.join(dir,n)),'-o',path.join(dir,'hook-test')],{stdio:'pipe'});
const output=cp.execFileSync(path.join(dir,'hook-test'),{cwd:dir,encoding:'utf8'});console.log(output.trim());
const t=C.parseTrace(fs.readFileSync(path.join(dir,'native.csv'),'utf8')),map=C.buildNativeMap(rom,a,t);assert.equal(map.metrics.hostReplacementEvents,2);assert.ok(t.events.some(e=>e.kind==='native_hook'));assert.ok(t.events.some(e=>e.kind==='return'));assert.ok(map.routines.some(n=>n.calledBy.length));
fs.writeFileSync(path.join(__dirname,'..','framework-validation-result.json'),JSON.stringify({output:output.trim(),traceEvents:t.events.length,mapMetrics:map.metrics},null,2));
console.log('native-hooks-framework-regression: OK');
