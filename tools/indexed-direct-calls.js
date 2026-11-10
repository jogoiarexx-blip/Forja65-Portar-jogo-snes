#!/usr/bin/env node
'use strict';
// Inventory only literal ROM-backed JSR/JSL, never assign a runtime witness.
function directCalls(source,rom,map){
 if(typeof source!=='string'||!rom||!rom.data||typeof map!=='function')throw Error('Invalid ROM/source');
 const unique=new Map();
 for(const m of source.matchAll(/\/\/ \$([0-9A-F]{6}) (JSR|JSL) -> \$([0-9A-F]{6}) stack real/g)){
  const from=Number.parseInt(m[1],16),to=Number.parseInt(m[3],16),kind=m[2];
  const offset=map(rom,from);
  if(offset==null)throw Error('Unmapped direct call '+m[1]);
  const n=kind==='JSR'?3:4;
  if(offset+n>rom.data.length)throw Error('Call operand out of ROM');
  const b=Array.from(rom.data.slice(offset,offset+n));
  const opcode=kind==='JSR'?0x20:0x22;
  const target=kind==='JSR'?((from&0xff0000)|b[1]|(b[2]<<8)):(b[1]|(b[2]<<8)|(b[3]<<16));
  if(b[0]!==opcode||target!==to)throw Error('Direct call operand differs from ROM '+m[1]);
  const key=m[1]+'|'+m[3]+'|'+kind;
  unique.set(key,{source:m[1],target:m[3],kind,operand_hex:b.map(x=>x.toString(16).toUpperCase().padStart(2,'0')).join(' '),proof:'ROM_LITERAL_CALL_NOT_EXECUTED'});
 }
 return [...unique.values()].sort((a,b)=>a.source.localeCompare(b.source)||a.target.localeCompare(b.target));
}
module.exports={directCalls};
