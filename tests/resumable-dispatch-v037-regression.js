// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const F=require('../forja65-core.js');
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^0\.(?:3|4)\.\d+/.test(F.VERSION),'familia v0.3.x esperada: '+F.VERSION);

// JSR $8010 cria return-site estatico em $8003. Depois testamos um RTS chegando
// nessa rotina sem nativeReturns: o runtime deve reconhecer $8003 e retomar o C++ ja recompilado.
let d=F.makeSyntheticRom();
d.fill(0xEA,0,0x40);
d.set([
  0x20,0x10,0x80, // $8000 JSR $8010
  0xDB,           // $8003 STP (return-site)
  0x80,0xFD       // $8004 BRA $8003 (nao deve ser necessario)
],0);
d[0x10]=0x60;     // $8010 RTS
const rom=F.loadRom(d,'resume.sfc'),a=F.analyze(rom,2048),p=F.generateProject(rom,a);
ok((a.staticReturnTargets||[]).includes(0x8003),'$8003 nao foi registrado como return-site estatico');
const dispatch=String(p['src/dispatch.cpp']);
ok(dispatch.includes('{0x008003u,'),'dispatcher compacto nao aceita endereco interno $8003');
ok(dispatch.includes('forja65_is_stack_return_target'),'return-site $8003 nao foi validado pelo resolvedor de retorno dinamico');
const units=Object.entries(p).filter(([k])=>/^src\/generated_\d+\.cpp$/.test(k)).map(([,v])=>String(v)).join('\n');
ok(units.includes('switch(entryPc&0xFFFFFFu)'),'funcao recompilada nao aceita retomada por endereco');
ok(dispatch.includes('forja65_compiled_alias'),'dispatcher nao resolve mirrors/aliases de ROM');
ok(dispatch.includes('cpu.pb=(std::uint8_t)(requested>>16)'),'PB nao e sincronizado na entrada real do dispatcher');
ok(units.includes('PB e sincronizado na entrada do dispatcher'),'unidades nao documentam preservacao do PB runtime');
ok(p['analysis.json'].includes('"resumable_dispatch": true'),'metadata resumable_dispatch ausente');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v037-'));
for(const [name,val] of Object.entries(p)){const q=path.join(dir,name);fs.mkdirSync(path.dirname(q),{recursive:true});fs.writeFileSync(q,val instanceof Uint8Array?Buffer.from(val):val);}
// Substitui apenas o main para exercitar retorno manual sem frame C++ nativo.
fs.writeFileSync(path.join(dir,'src','main.cpp'),`#include "generated.hpp"\n#include <cassert>\nint main(){CpuState cpu;SnesRuntime hw("assets/cart-data.bin",MapperKind::LoROM,0,0,0,CartChip::None,"save.srm");cpu.pb=0;cpu.push16Value(hw,0x8002u);forja65_dispatch(cpu,hw,0x008010u,0x00DEADu);assert(hw.stopped);assert(cpu.s==0x01FFu);return 0;}\n`);
cp.execFileSync('cmake',['-S',dir,'-B',path.join(dir,'build')],{stdio:'ignore'});
cp.execFileSync('cmake',['--build',path.join(dir,'build'),'-j','2'],{stdio:'ignore'});
const exe=path.join(dir,'build',process.platform==='win32'?'game.exe':'game');
cp.execFileSync(exe,[],{cwd:path.join(dir,'build'),stdio:'inherit',timeout:60000});
console.log('Resumable dispatch v0.3.10 regression: PASS',{returnSites:a.staticReturnTargets.length,dispatchTargets:JSON.parse(p['analysis.json']).cfg.dispatch_targets});
