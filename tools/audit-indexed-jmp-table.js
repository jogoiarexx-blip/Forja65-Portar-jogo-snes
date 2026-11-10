#!/usr/bin/env node
'use strict';
// ROM-backed 65C816 JMP ($hhhh,X) table inspection; never creates runtime hints
// or treats an unobserved table entry as proof that the game executes it.
const fs = require('node:fs');
const path = require('node:path');
const C = require('../forja65-core');
function parseAddress(v){
  if(!/^(?:0x|\$)?[0-9a-f]{1,6}$/i.test(String(v)))throw Error('Expected SNES hexadecimal address');
  return parseInt(String(v).replace(/^(?:0x|\$)/i,''),16);
}
function read(rom,addr){
  const at=C.snesToRom(rom,addr);
  if(at===null)throw Error('Address outside mapped cartridge: $'+C.hex(addr,6));
  return rom.data[at];
}
function audit(rom,site,count,hints=[]){
  if(!Number.isInteger(site)||site<0||site>0xffffff)throw Error('Invalid JMP site');
  if(!Number.isInteger(count)||count<1||count>256)throw Error('Table entries must be 1..256');
  if(read(rom,site)!==0x7c)throw Error('Site is not JMP ($abs,X) opcode 7C');
  const bank=(site>>>16)&255;
  if((site&0xffff)>0xfffd)throw Error('JMP operand crosses program bank');
  const base=read(rom,(site+1)&0xffffff)|(read(rom,(site+2)&0xffffff)<<8);
  if(base+count*2>0x10000)throw Error('Table crosses $FFFF boundary; split ranges explicitly');
  const fingerprint=C.romFingerprint(rom);
  if(hints.some(h=>h.rom!==fingerprint))throw Error('Observed hint ROM fingerprint does not match cartridge');
  const rows=[];
  for(let i=0;i<count;i++){
    const pointer=(bank<<16)|(base+2*i);
    const target=(bank<<16)|(read(rom,pointer)|(read(rom,pointer+1)<<8));
    const observations=hints.filter(h=>h.kind.toUpperCase()==='FLOW'&&h.from===site&&h.target===target);
    rows.push({index:i,romPointer:'$'+C.hex(pointer,6),target:'$'+C.hex(target,6),mapped:C.isRomAddress(rom,target),observedInThisRom:observations.length>0,observations:observations.reduce((a,b)=>a+(b.observed||1),0)});
  }
  return {schema:'forja65.indexed-jmp-table-audit.v1',rom:fingerprint,title:rom.header.title,mapping:rom.header.mapping,
    source:'$'+C.hex(site,6),operandBase:'$'+C.hex((bank<<16)|base,6),entries:rows,
    limitations:['Candidate pointer bytes come from the cartridge; table count is supplied by the investigator.',
      'A ROM pointer alone does not establish an executable entry or CPU M/X/C state.',
      'Only fingerprint-matched FLOW hints count as observed; the tool does not create hints.']};
}
function main(args){
  const a={};for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1])throw Error('Usage: --rom cart.sfc --site 0x8083E8 --entries 3 [--hints observed.txt] [--out report.json]');a[args[i].slice(2)]=args[i+1];}
  if(!a.rom||!a.site||!a.entries)throw Error('Missing --rom, --site, or --entries');
  if(!/^\d+$/.test(a.entries))throw Error('--entries must be decimal');
  const rom=C.loadRom(fs.readFileSync(a.rom),path.basename(a.rom));
  const hints=a.hints?C.parseRuntimeHints(fs.readFileSync(a.hints,'utf8')):[];
  const result=audit(rom,parseAddress(a.site),Number(a.entries),hints),encoded=JSON.stringify(result,null,2)+'\n';
  if(a.out){fs.mkdirSync(path.dirname(path.resolve(a.out)),{recursive:true});fs.writeFileSync(a.out,encoded);}
  else process.stdout.write(encoded);
  console.log(`ROM table: ${result.source}, ${result.entries.length} candidate pointers, ${result.entries.filter(x=>x.observedInThisRom).length} observed target(s).`);
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error('Forja65 indexed table audit: '+e.message);process.exitCode=2;}}
module.exports={audit,parseAddress};
