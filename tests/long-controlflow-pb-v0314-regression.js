// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^(?:0\.3\.|0\.4\.)/.test(F.VERSION),'versao inesperada: '+F.VERSION);
// LoROM 64 KiB: $80:8000 JML $81:8000; em $81:8000 ha JSR $8010.
// JSR absoluto deve herdar PB=$81, nunca o banco $80 do bloco recompilado anterior.
const d=new Uint8Array(0x10000); d.fill(0xEA);
const h=0x7FC0; const title='FORJA65 JML PB TEST'; for(let i=0;i<title.length;i++)d[h+i]=title.charCodeAt(i);
d[h+0x15]=0x20; d[h+0x16]=0x00; d[h+0x17]=0x06; d[h+0x18]=0x00;
d[h+0x3C]=0x00; d[h+0x3D]=0x80; // reset $8000
// bank $80 @ file 0
let o=0; d.set([0x5C,0x00,0x80,0x81],o); // JML $818000
// bank $81 @ file $8000
const b=0x8000; d.set([0x20,0x10,0x80,0xDB],b); // JSR $8010 ; STP
// callee bank $81:$8010
d[b+0x10]=0x60; // RTS
const rom=F.loadRom(d,'jml-pb.sfc'); const a=F.analyze(rom,4096); const p=F.generateProject(rom,a);
const generated=Object.entries(p).filter(([n])=>/^src\/generated_\d+\.cpp$/.test(n)).map(([,v])=>String(v)).join('\n');
ok(generated.includes('cpu.pb=0x81u; // JML troca o Program Bank'), 'JML local nao atualiza PB para $81');
ok(generated.includes('((std::uint32_t(cpu.pb)<<16)|0x8010u)'), 'JSR absoluto deixou de usar PB runtime');
ok(p['analysis.json'].includes('"long_jump_program_bank": true'),'metadata long_jump_program_bank ausente');
console.log('Long control-flow PB v0.3.14 regression: PASS',{decoded:a.decoded,native:a.native});
