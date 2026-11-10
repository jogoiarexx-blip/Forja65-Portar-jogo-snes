const F=require('../forja65-core.js');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
function fail(m){throw new Error(m)}
const d=F.makeSyntheticRom();
// $008000: CLC; BCC $8007; LDA #$01; BRA $8009; LDA #$02; JSR $8020; RTS
// $008020: INX; RTS
const code=[0x18,0x90,0x04,0xA9,0x01,0x80,0x02,0xA9,0x02,0x20,0x20,0x80,0x60];
d.set(code,0);d.set([0xE8,0x60],0x20);
const rom=F.loadRom(d,'cfg-v014.sfc');
const a=F.analyze(rom,512);
if(a.cfgFunctions!==2)fail(`cfgFunctions esperado 2, veio ${a.cfgFunctions}`);
if(a.cfgCalls!==1)fail(`cfgCalls esperado 1, veio ${a.cfgCalls}`);
if(a.unsupported!==0||a.partial!==0)fail(`esperado CPU direta sem partial/unsupported, veio p=${a.partial} u=${a.unsupported}`);
for(const pc of [0x8001,0x8005,0x8009]){
  const i=a.instructions.find(x=>x.pc===pc);if(!i||i.status!=='native')fail(`flow $${pc.toString(16)} nao ficou native`);
}
const p=F.generateProject(rom,a),g=Object.entries(p).filter(([k])=>k==='src/dispatch.cpp'||/^src\/generated_\d+\.cpp$/.test(k)).map(([,v])=>String(v)).join('\n');
if(!/if \(!cpu\.c\) \{ hw\.addCpuInternalCycles\(1u\); goto L_008007; \}/.test(g))fail('branch C++ com timing nao emitido');
if(!g.includes('goto L_008009;'))fail('BRA C++ nao emitido');
// Exercise the generated JSR and RTS rather than requiring one spelling of
// the emitted call. Both recursive and iterative dispatch share this ABI.
const out=fs.mkdtempSync(path.join(os.tmpdir(),'forja-direct-call-'));
try{
 for(const[n,v]of Object.entries(p))if(n.startsWith('src/')||n==='assets/cart-data.bin'){
  fs.mkdirSync(path.dirname(path.join(out,n)),{recursive:true});fs.writeFileSync(path.join(out,n),v);
 }
 fs.writeFileSync(path.join(out,'test.cpp'),`#include "generated.hpp"
int main(){SnesRuntime h("assets/cart-data.bin",MapperKind::LoROM);CpuState c;c.enforceEmulation();
c.push16Value(h,0x802f);h.pushNativeReturn(0x8030,false,c);forja65_dispatch(c,h,0x8000,0);
return c.a!=2||c.x!=1||c.pb!=0||c.s!=0x1ff||!h.nativeReturns.empty();}
`);
 const sources=Object.keys(p).filter(n=>/^src\/generated_.*cpp$/.test(n)||n==='src/dispatch.cpp').map(n=>path.join(out,n));
 cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-I',path.join(out,'src'),path.join(out,'test.cpp'),...sources,'-o',path.join(out,'test')],{stdio:'inherit'});
 cp.execFileSync(path.join(out,'test'),[],{cwd:out,stdio:'inherit'});
}finally{fs.rmSync(out,{recursive:true,force:true});}
if(/fetch|decode|switch\s*\(.*opcode/i.test(g))fail('dispatcher de opcode apareceu no C++ gerado');
console.log('CFG direct v0.1.4 regression: PASS', {functions:a.cfgFunctions,blocks:a.cfgBlocks,edges:a.cfgEdges,calls:a.cfgCalls,decoded:a.decoded});
