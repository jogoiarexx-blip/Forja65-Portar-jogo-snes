// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^0\.(?:3|4)\.\d+/.test(F.VERSION),'familia v0.3.x esperada: '+F.VERSION);
const hints=F.parseRuntimeHints('target=B28FD0 from=BBB8EB kind=STACK-RTL e=0 m=0 x=0 c=0');
ok(hints.length===1&&hints[0].target===0xB28FD0,'runtime hint nao parseado');
ok(hints[0].kind==='STACK-RTL'&&hints[0].state.emulation===false,'estado do runtime hint incorreto');
const rom=F.loadRom(F.makeSyntheticRom(),'v035.sfc'),a=F.analyze(rom),p=F.generateProject(rom,a);
const units=Object.keys(p).filter(k=>/^src\/generated_\d+\.cpp$/.test(k));
ok(units.length>=1,'build fragmentado nao gerou unidades C++');
const code=units.map(k=>String(p[k])).join('\n');
ok(code.includes('goto L_008000;'),'funcao C++ nao preserva entrypoint real');
ok(code.includes('hw.traceInstruction('),'ring trace nao inserido por instrucao');
ok(/for\(;;\)\{[\s\S]*?hw\.dispatchPending=false/.test(p['src/dispatch.cpp']||''),'dispatcher iterativo ausente');
ok((p['src/main.cpp']||'').includes('FORJA65_HEADLESS_FRAMES'),'limite headless por ambiente ausente');
const h=p['src/runtime.hpp'];
for(const q of ['FORJA65_WATCHDOG_INSTRUCTIONS','forja65-crash-trace.txt','forja65-runtime-hints.txt','requestDispatch','cpuTrace'])ok(h.includes(q),'runtime checkpoint sem '+q);
ok(p['analysis.json'].includes('"fragmented_cpp_units": true'),'metadata build fragmentado ausente');
ok(p['analysis.json'].includes('"spc700_runtime_interpreter": true'),'metadata SPC700 runtime ausente');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v035-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});fs.writeFileSync(path.join(dir,'src','runtime.hpp'),h);
fs.writeFileSync(path.join(dir,'test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){ApuBridge a;for(int i=0;i<2048;i++)a.tickMasterCycles(42);/* REV195: perfil SPC de referencia (custo real do IPL, ~2.500 ciclos SPC ate $AA/$BB) */assert(a.read(0)==0xAA);assert(a.read(1)==0xBB);SnesRuntime hw;CpuState c;hw.traceInstruction(0x808000,c);assert(hw.cpuInstructionCount==1);return 0;}\n`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});cp.execFileSync(path.join(dir,'test'),[],{stdio:'inherit'});
console.log('Runtime progress v0.3.5 checkpoint regression: PASS',{units:units.length,hint:hints[0].target.toString(16)});
