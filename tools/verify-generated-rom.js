#!/usr/bin/env node
'use strict';
// Read-only consistency audit for cross-project Forja65 generated CPU CFGs.
// Compares every emitted opcode trace with its physical ROM byte. This proves
// source provenance and decoder agreement, NOT dynamic CPU equivalence.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const C=require('../forja65-core.js');
function verify(romBytes,cppText,entry,expectedFingerprint=null){
 const rom=C.loadRom(new Uint8Array(romBytes));
 const fnv=C.romFingerprint(rom);
 if(expectedFingerprint&&expectedFingerprint.toLowerCase()!==fnv)throw Error('ROM fingerprint differs from expected project: '+fnv);
 const entryHex=Number.parseInt(String(entry).replace(/^0x/i,''),16).toString(16).toUpperCase().padStart(6,'0');
 if(!cppText.includes('L_'+entryHex+':'))throw Error('Entry label absent: '+entryHex);
 const labels=[...cppText.matchAll(/^L_([0-9A-F]{6}):\s*$/gm)],seen=new Map(),differences=[];
 if(!labels.length)throw Error('No Forja65 labels in generated C++');
 for(let idx=0;idx<labels.length;idx++){
  const pc=Number.parseInt(labels[idx][1],16);
  const block=cppText.slice(labels[idx].index,idx+1<labels.length?labels[idx+1].index:cppText.length);
  const actual=block.match(/hw\.traceInstruction\([^\n]*cpu,0x([0-9A-Fa-f]{2})u\)/);
  if(!actual)throw Error('Missing opcode provenance trace at '+labels[idx][1]);
  const opcode=Number.parseInt(actual[1],16),off=C.snesToRom(rom,pc);
  if(off===null||off===undefined||off<0||off>=rom.data.length)throw Error('Unmapped ROM label '+labels[idx][1]);
  const expected=rom.data[off];
  if(opcode!==expected)differences.push({pc:labels[idx][1],emitted:opcode,rom:expected});
  if(seen.has(pc)&&seen.get(pc)!==opcode)throw Error('Multiple opcode encodings at '+labels[idx][1]);
  seen.set(pc,opcode);
 }
 if(differences.length)throw Error('ROM opcode mismatches: '+JSON.stringify(differences.slice(0,6)));
 const sha=crypto.createHash('sha256').update(rom.data).digest('hex');
 const sourceSha=crypto.createHash('sha256').update(cppText).digest('hex');
 return {schema:'forja65.generated-rom-provenance.v1',rom:{fnv1a64:fnv,sha256:sha,bytes:rom.data.length},entry:entryHex,unique_rom_opcodes:seen.size,total_emitted_opcode_traces:labels.length,code_sha256:sourceSha,rom_opcode_mismatches:0,scope:'Static opcode provenance only; no CPU state or gameplay equivalence established.'};
}
if(require.main===module){
 try {
  const [romPath,cppPath,entry]=process.argv.slice(2);
  if(!romPath||!cppPath||!entry)throw Error('Usage: node tools/verify-generated-rom.js cart-data.bin generated.cpp BEC69E [expected-fnv] [report.json]');
  const report=verify(fs.readFileSync(romPath),fs.readFileSync(cppPath,'utf8'),entry,process.argv[5]);
  if(process.argv[6])fs.writeFileSync(path.resolve(process.argv[6]),JSON.stringify(report,null,2)+'\n');
  console.log('Forja65 ROM provenance: '+report.entry+' '+report.unique_rom_opcodes+' distinct opcodes checked; ROM '+report.rom.fnv1a64+' PASS (runtime equivalence not proven)');
 }catch(e){console.error('Forja65 provenance rejected: '+e.message);process.exitCode=2;}
}
module.exports={verify};
