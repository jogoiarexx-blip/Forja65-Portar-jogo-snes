// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^0\.(?:3|4)\.\d+/.test(F.VERSION),'familia v0.3.x esperada: '+F.VERSION);

// HiROM: $00:8000 e $80:8000 apontam para o mesmo byte fisico.
const aliasRom=F.loadRom(F.makeSyntheticRom(),'alias.sfc');
aliasRom.header.mapping=F.MAP.HIROM;
ok(F.snesToRom(aliasRom,0x008000)===F.snesToRom(aliasRom,0x808000),'mirror HiROM nao foi normalizado');

// NMI nativo precisa existir nas quatro larguras M/X porque o hardware nao fixa esses bits.
let d=F.makeSyntheticRom(),h=0x7FC0;d[h+0x2A]=0x20;d[h+0x2B]=0x80;d.set([0x40],0x20);
const vr=F.loadRom(d,'vectors.sfc'),va=F.analyze(vr,2048);
const nmi=va.entryPoints.filter(e=>e.name.startsWith('NMI-NATIVE')&&e.target===0x8020);
ok(nmi.length===4,'NMI nativo deveria ter quatro variantes M/X, veio '+nmi.length);

const rom=F.loadRom(F.makeSyntheticRom(),'v038.sfc'),a=F.analyze(rom),p=F.generateProject(rom,a);
const dispatch=String(p['src/dispatch.cpp']);
ok(dispatch.includes('forja65_compiled_alias'),'dispatcher de alias ROM ausente');
ok(dispatch.includes('cpu.pb=(std::uint8_t)(requested>>16)'),'PB nao sincronizado pelo endereco realmente requisitado');
ok(p['analysis.json'].includes('"rom_mirror_dispatch": true'),'metadata de mirror ROM ausente');
ok(p['analysis.json'].includes('"cpu_emulation_state_parity": true'),'metadata de paridade E/M/X ausente');
ok(p['analysis.json'].includes('"spc700_runtime_interpreter": true'),'metadata do SPC700 runtime ausente');
ok(p['analysis.json'].includes('"interrupt_state_variants": true'),'metadata de variantes de interrupcao ausente');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v038-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),p['src/runtime.hpp']);
fs.writeFileSync(path.join(dir,'test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){\n  CpuState c; SnesRuntime hw;\n  c.e=false;c.m8=false;c.x8=false;c.x=0xABCD;c.y=0xCDEF;c.s=0x4321;c.c=true;c.xce();\n  assert(c.e&&c.m8&&c.x8&&c.x==0x00CD&&c.y==0x00EF&&(c.s&0xFF00u)==0x0100u);\n  c.e=false;c.x8=false;c.x=0xBEEF;c.sep(0x10);assert(c.x8&&c.x==0x00EF);\n  ApuBridge apu;for(int i=0;i<2048;i++)apu.tickMasterCycles(42);/* REV195: perfil SPC de referencia (custo real do IPL, ~2.500 ciclos SPC ate $AA/$BB) */\n  assert(apu.read(0)==0xAA&&apu.read(1)==0xBB);\n  return 0;\n}\n`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});
cp.execFileSync(path.join(dir,'test'),[],{stdio:'inherit'});
console.log('ROM mirror/SPC700/state v0.3.10 regression: PASS',{nmiVariants:nmi.length,apu:a.apuBridge});
