const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
// Validate the corrected $DC mnemonic and non-ROM target handling.
let d=F.makeSyntheticRom();let rom=F.loadRom(d,'v018.sfc');
rom.data[0]=0xDC;rom.data[1]=0;rom.data[2]=0;let i=F.decodeOne(rom,0x008000,{emulation:true,m8:true,x8:true,carry:null});
ok(i.mnemonic==='JMP'&&i.mode==='AbsoluteIndirectLong','$DC must be JMP [abs]');
// LoROM lower half in bank 01 is RAM/I/O and must not be treated as ROM.
ok(F.snesToRom(rom,0x014082)===null,'$014082 must not map to LoROM ROM');
// REV194: placa LOROM do bsnes deixa $40-7D:0000-7FFF em barramento aberto; o espelho antigo continua no perfil legado.
ok(F.snesToRom(rom,0x400000)===null,'$400000 LoROM lower half is open bus (bsnes boards.bml)');
ok(F.snesToRom(F.loadRom(F.makeSyntheticRom(),'v018-legacy.sfc',{mapping:'legacy'}),0x400000)!==null,'$400000 LoROM mirror should map in legacy profile');
// Create reset with JSL $014082. Analyzer must report source, not attempt DECODE at target.
d=F.makeSyntheticRom();d.set([0x22,0x82,0x40,0x01,0x60],0);rom=F.loadRom(d,'bad-target.sfc');const a=F.analyze(rom,512);
ok(a.issues.some(x=>x.kind==='CFG-NONROM-TARGET'&&x.pc===0x008000),'invalid direct target should be CFG-NONROM-TARGET');
ok(!a.issues.some(x=>x.kind==='DECODE'&&x.pc===0x014082),'must not decode invalid $014082');
// Seed a native NMI vector and verify it becomes an entry point.
d=F.makeSyntheticRom();const h=0x7FC0;d[h+0x2A]=0x20;d[h+0x2B]=0x80;d.set([0x60],0x20);rom=F.loadRom(d,'nmi.sfc');const b=F.analyze(rom,512);
ok(b.entryPoints.some(e=>e.name.startsWith('NMI-NATIVE')&&e.target===0x8020),'native NMI vector missing');
console.log('CFG/vectors v0.1.8 regression: PASS',{entryPoints:b.cfgEntryPoints,functions:b.cfgFunctions});
