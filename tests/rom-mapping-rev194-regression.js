// REV194: deteccao de cabecalho (heuristica bsnes) e mapa base de ROM conferidos com bsnes v115.
// Gera as ROMs-sonda (tools/rev194/gen_mapping_probe.py) e compara snesToRom com as leituras gravadas do bsnes
// em tools/rev194/mapping-reference.json. Sem python3 o teste de sondas e pulado (os casos sinteticos rodam).
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const F=require(path.join(root,'forja65-core.js'));

// 1) casos sinteticos de deteccao
function synth(size,hdr,mode,type,resetOp=0x78){
  const d=new Uint8Array(size);
  d.set(Buffer.from('FORJA SYNTH TEST     '),hdr);d[hdr+0x15]=mode;d[hdr+0x16]=type;d[hdr+0x17]=0x0C;d[hdr+0x18]=0x03;d[hdr+0x19]=1;d[hdr+0x1A]=0x01;
  d[hdr+0x1C]=0xFF;d[hdr+0x1D]=0xFF;d[hdr+0x1E]=0;d[hdr+0x1F]=0;d[hdr+0x3C]=0x00;d[hdr+0x3D]=0x80;
  d[(hdr&~0x7FFF)|0x0000]=resetOp; // primeiro opcode no vetor de reset ($8000)
  return d;
}
const cases=[
  [synth(0x100000,0x7FC0,0x20,0x00),'LoROM',null,0x7FC0],
  [synth(0x400000,0xFFC0,0x31,0x02),'HiROM',null,0xFFC0],
  [synth(0x600000,0x40FFC0,0x35,0x02),'ExHiROM',null,0x40FFC0],
  [synth(0x600000,0x407FC0,0x30,0x02),'ExLoROM',null,0x407FC0],
  [synth(0x200000,0x7FC0,0x23,0x35),'LoROM','SA1',0x7FC0],
  [synth(0x400000,0x7FC0,0x32,0x45),'LoROM','SDD1',0x7FC0],
  [synth(0x100000,0x7FC0,0x20,0x15),'LoROM','GSU',0x7FC0],
];
for(const [d,mapping,board,at] of cases){
  const r=F.loadRom(d,'synth.sfc');
  assert.strictEqual(r.header.mapping,mapping,'mapping '+mapping);
  assert.strictEqual(r.header.board||null,board,'board '+board);
  assert.strictEqual(r.header.headerOffset,at,'header '+at.toString(16));
}
// ExHiROM: bancos $80-$FF ficam na metade baixa do arquivo, $00-$7D na alta (bsnes boards.bml / Snes9x).
{const r=F.loadRom(cases[2][0],'x.sfc');
 assert.strictEqual(F.snesToRom(r,0xC00000),0x000000);assert.strictEqual(F.snesToRom(r,0x808000),0x008000);
 assert.strictEqual(F.snesToRom(r,0x400000),0x400000);assert.strictEqual(F.snesToRom(r,0x008000),0x408000);}
// perfil legado reproduz a REV193
{const r=F.loadRom(cases[0][0],'x.sfc',{mapping:'legacy'});assert.strictEqual(r.header.mappingProfile,'legacy');
 assert.strictEqual(F.snesToRom(r,0x400000),0x000000); // espelho antigo (1 MiB)
 const n=F.loadRom(cases[0][0],'x.sfc');assert.strictEqual(F.snesToRom(n,0x400000),null);}

// 2) sondas contra bsnes
const ref=JSON.parse(fs.readFileSync(path.join(root,'tools/rev194/mapping-reference.json'),'utf8'));
const py=['python3','python'].find(c=>{try{return cp.spawnSync(c,['--version']).status===0;}catch(_){return false;}});
if(!py){console.log('rom-mapping-rev194: python ausente; sondas puladas, casos sinteticos ok');process.exit(0);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev194-map-'));
try{
  const g=cp.spawnSync(py,[path.join(root,'tools/rev194/gen_mapping_probe.py'),dir],{encoding:'utf8'});
  assert.strictEqual(g.status,0,g.stderr);
  let total=0,ok=0;const bad=[];
  for(const [name,tab] of Object.entries(ref.probes)){
    if(name.endsWith('-mmc'))continue; // REV195: sonda com bancos trocados em tempo de execucao ($4831-$4834); conferida no runtime C++
    const rom=F.loadRom(new Uint8Array(fs.readFileSync(path.join(dir,name+'.sfc'))),name+'.sfc');
    const reads=tab.bsnes;
    for(const k of Object.keys(reads)){
      if(k.endsWith('w'))continue;const a=parseInt(k,16);if((a&3)!==0)continue;
      const b1=reads[(a+1).toString(16).toUpperCase().padStart(6,'0')],b2=reads[(a+2).toString(16).toUpperCase().padStart(6,'0')];
      if(b1===undefined||b2===undefined)continue;
      const o=(reads[k]<<16)|(b1<<8)|b2,isRom=(o&3)===0&&((o&0x7FFF)===(a&0x7FFF));
      if(!isRom)continue; // barramento aberto/RAM: conferido pelo runtime (tools/rev194/run_mapping_probe.py)
      total++;const got=F.snesToRom(rom,a);
      if(got===o)ok++;else bad.push(name+' $'+k+' bsnes=$'+o.toString(16)+' forja='+(got===null?'null':'$'+got.toString(16)));
    }
  }
  assert.deepStrictEqual(bad,[],bad.slice(0,10).join('\n'));
  assert.ok(total>900,'poucas sondas de ROM: '+total);
  console.log('rom-mapping-rev194: '+ok+'/'+total+' leituras de ROM iguais ao bsnes em '+Object.keys(ref.probes).length+' placas');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
