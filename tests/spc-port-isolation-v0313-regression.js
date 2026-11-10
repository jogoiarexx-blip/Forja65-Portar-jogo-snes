// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^0\.(?:3|4)\.\d+/.test(F.VERSION),'familia v0.3.x esperada: '+F.VERSION);
const rom=F.loadRom(F.makeSyntheticRom(),'spc-isolation.sfc'),a=F.analyze(rom,1024),p=F.generateProject(rom,a);
ok(p['analysis.json'].includes('"spc_cpu_port_isolation": true'),'metadata de isolamento CPU-SPC ausente');
const h=p['src/runtime.hpp'];
ok(!/spc\.ram\[\(uploadBase\+uploadCount\)/.test(h),'porta CPU ainda grava diretamente na RAM viva do SPC');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v0313-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),h);
fs.writeFileSync(path.join(dir,'test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){\n ApuBridge a;\n a.spc.ram[0x0200]=0x5A;\n a.write(2,0x00);a.write(3,0x02);a.write(1,0xA5);a.write(0,0x01);\n assert(a.spc.portIn[0]==0x01&&a.spc.portIn[1]==0xA5);\n assert(a.spc.ram[0x0200]==0x5A); // CPU/APU ports nao sao RAM compartilhada.\n for(int i=0;i<2048;i++)a.tickMasterCycles(42);\n // O IPL continua responsavel por toda escrita real na RAM SPC e pelas portas de saida.\n return 0;\n}\n`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});
cp.execFileSync(path.join(dir,'test'),[],{stdio:'inherit'});
console.log('SPC CPU-port isolation v0.3.13 regression: PASS');
