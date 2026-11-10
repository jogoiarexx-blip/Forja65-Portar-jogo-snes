// Reference: ares 9408cb43d4948fc3ea6e152a307a34348df3fe04, ares/sfc/cpu/{dma,irq,io,timing}.cpp.
// Pinned ares readCPU RDNMI replaces bits 7 and 0..3; preserves MDR bits 4..6.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert');const C=require('../forja65-core.js');const rom=C.loadRom(C.makeSyntheticRom()),a=C.analyze(rom,128),files=C.generateProject(rom,a),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-trace-bus-'));
for(const n of ['src/runtime.hpp','src/forja_trace.hpp','src/forja_ir.hpp']){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,files[n]);}
fs.writeFileSync(path.join(dir,'bus.cpp'),String.raw`#include "src/runtime.hpp"
#include "src/forja_trace.hpp"
#include "src/forja_ir.hpp"
#include <cassert>
int main(){SnesRuntime hw;hw.trace.start("bus.csv","fixture",100);hw.traceRoutine=0x8020;CpuState c;hw.traceInstruction(0x8020,c,0xad);
 hw.cpuDataBus=0x70;hw.io.nmiPending=true;assert(hw.read(0x4210)==0xF2);assert(!hw.io.nmiPending);assert(hw.read(0x4210)==0x72);
 hw.io.wramPortAddr=5;hw.ram[5]=77;assert(hw.read(0x2180)==77&&hw.io.wramPortAddr==6);
 hw.nativeDmaEnabled=true;hw.ppu.write(0x2121,0);hw.ram[0x10]=31;hw.ram[0x11]=0;hw.dma[0].a1b=0x7e;hw.dma[0].a1t=0x10;hw.dma[0].das=2;hw.dma[0].bbad=0x22;hw.executeDma(1);assert(hw.ppu.cgram[0]==31);assert(std::string(hw.traceSource)=="CPU");hw.trace.close();
 hw.trace.start("limited.csv","fixture",2);hw.trace.emit(0,0,0,"read","WRAM",1,0);hw.trace.emit(0,0,0,"read","WRAM",2,0);hw.trace.emit(0,0,0,"read","WRAM",3,0);hw.trace.close();
 ForjaRenderer r;ForjaIR::setPalette(0,{7}).apply(r);bool rejected=false;try{ForjaIR::setPalette(1,{0x8000}).apply(r);}catch(const std::out_of_range&){rejected=true;}assert(rejected&&r.palette[0]==7&&r.palette[1]==0);
}`);
cp.execFileSync('g++',['-std=c++20','-O0',path.join(dir,'bus.cpp'),'-o',path.join(dir,'bus')],{stdio:'pipe'});cp.execFileSync(path.join(dir,'bus'),[],{cwd:dir});const t=C.parseTrace(fs.readFileSync(path.join(dir,'bus.csv'),'utf8'));const rdnmi=t.events.filter(e=>e.kind==='read'&&e.address===0x4210);assert.deepEqual(rdnmi.map(e=>e.value),[0xF2,0x72]);assert.equal(t.events.filter(e=>e.kind==='write'&&e.space==='CGRAM'&&e.source==='DMA').length,2);assert.equal(t.events.filter(e=>e.kind==='read'&&e.space==='WRAM'&&e.source==='DMA').length,2);const limited=C.parseTrace(fs.readFileSync(path.join(dir,'limited.csv'),'utf8'));assert.equal(limited.events.length,2);assert.equal(limited.dropped,1);
cp.execFileSync('g++',['-std=c++20','-DFORJA65_ENABLE_TRACE=0','-O2',path.join(dir,'bus.cpp'),'-o',path.join(dir,'disabled')],{stdio:'pipe'});fs.unlinkSync(path.join(dir,'bus.csv'));fs.unlinkSync(path.join(dir,'limited.csv'));cp.execFileSync(path.join(dir,'disabled'),[],{cwd:dir});assert.ok(!fs.existsSync(path.join(dir,'bus.csv')));assert.ok(!fs.existsSync(path.join(dir,'limited.csv')));
console.log('trace-bus-framework-regression: OK (side effects, DMA fast path, cap, trace-disabled build)');
