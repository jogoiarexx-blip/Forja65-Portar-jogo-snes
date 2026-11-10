#!/usr/bin/env node
'use strict';
// ROM-bound importer for 65816 JMP (abs,X) 7C and JSR (abs,X) FC.
// Checks actual pointer-table bytes and observed X, not just an error string.
// Produces a guarded CFG hint, never proof of semantic handler equivalence.
const fs=require('fs'),path=require('path');
const C=require('../forja65-core.js');
function verify(romBytes,traceText,errorText,hintsText=''){
 const rom=C.loadRom(new Uint8Array(romBytes)),fingerprint=C.romFingerprint(rom);
 const old=C.parseRuntimeHints(hintsText);
 if(old.some(h=>h.rom!==fingerprint))throw Error('Prior hints belong to a different ROM');
 const match=errorText.match(/fluxo CFG nao resolvido em pc=(\d+)\s+target=(\d+)/);
 if(!match)throw Error('Missing unresolved CFG flow in runtime error');
 const site=Number(match[1]),target=Number(match[2]);
 if(!Number.isSafeInteger(site)||site>0xFFFFFF||!Number.isSafeInteger(target)||target>0xFFFFFF)throw Error('Bad PC or target range');
 const siteHex=site.toString(16).padStart(6,'0');
 const lines=traceText.split(/\r?\n/).filter(row=>new RegExp('^'+siteHex+'\\s','i').test(row));
 if(!lines.length)throw Error('Missing CPU state for last unresolved site');
 const trace=lines[lines.length-1];
 const get=(name)=>{let m=trace.match(new RegExp('(?:^|\\s)'+name+'=([0-9a-f]+)(?=\\s|$)','i'));if(!m)throw Error('Missing '+name+' in CPU trace');return parseInt(m[1],16);};
 const index=get('X'),pb=get('PB'),e=get('E'),m=get('M'),x8=get('X8'),c=get('C');
 if(pb!==(site>>16)||[e,m,x8,c].some(n=>n!==0&&n!==1))throw Error('CPU bank/flags mismatch');
 const off=C.snesToRom(rom,site);
 if(!Number.isInteger(off)||off<0||off+2>=rom.data.length)throw Error('Source is not a mapped ROM opcode');
 const opcode=rom.data[off];
 if(opcode!==0x7c&&opcode!==0xfc)throw Error('Source is not indexed JMP/JSR opcode 7C or FC');
 const mnemonic=opcode===0xfc?'JSR':'JMP';
 const base=rom.data[off+1]|(rom.data[off+2]<<8);
 const table=(pb<<16)|((base+(x8?(index&0xff):index))&0xffff);
 const ptrlo=C.snesToRom(rom,table),ptrhi=C.snesToRom(rom,(table&0xff0000)|((table+1)&0xffff));
 if(!Number.isInteger(ptrlo)||!Number.isInteger(ptrhi)||ptrlo<0||ptrhi<0)throw Error('Indexed target table not mapped in ROM');
 const computed=(pb<<16)|(rom.data[ptrlo]|rom.data[ptrhi]<<8);
 if(computed!==target)throw Error(`Indexed ROM target mismatch: observed ${target.toString(16)}, computed ${computed.toString(16)}`);
 const observation=`rom=${fingerprint} target=${target.toString(16).toUpperCase().padStart(6,'0')} from=${site.toString(16).toUpperCase().padStart(6,'0')} kind=${mnemonic==='JSR'?'CALL':'FLOW'} e=${e} m=${m} x=${x8} c=${c} observed=1`;
 const existing=old.some(h=>h.target===target&&h.from===site&&h.state.emulation===Boolean(e)&&h.state.m8===Boolean(m)&&h.state.x8===Boolean(x8)&&h.state.carry===Boolean(c));
 const merged=C.mergeRuntimeHints(hintsText,observation);
 return {hints:merged,report:{schema:'forja65.verified-indexed-flow.v1',rom:fingerprint,site:siteHex.toUpperCase(),target:target.toString(16).toUpperCase().padStart(6,'0'),x:index,pb,e,m,x8,c,opcode:opcode.toString(16).toUpperCase().padStart(2,'0'),mnemonic,kind:mnemonic==='JSR'?'CALL':'FLOW',pointer_table_base:base.toString(16).toUpperCase().padStart(4,'0'),pointer_address:table.toString(16).toUpperCase().padStart(6,'0'),pointer_value:computed&0xffff,already_present:existing,static_pointer_verified:true,semantic_equivalence_proven:false}};
}
if(require.main===module){
 try{
  const [rom,trace,err,hintsFile,out]=process.argv.slice(2);
  if(!rom||!trace||!err||!hintsFile||!out)throw Error('Usage: node tools/ingest-indexed-flow.js ROM trace.txt last-error.txt hints.txt output-dir');
  const result=verify(fs.readFileSync(rom),fs.readFileSync(trace,'utf8'),fs.readFileSync(err,'utf8'),fs.readFileSync(hintsFile,'utf8'));
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'runtime-hints.txt'),result.hints.trimEnd()+'\n');fs.writeFileSync(path.join(out,'verified-flow.json'),JSON.stringify(result.report,null,2)+'\n');
  console.log('ROM indexed '+result.report.mnemonic+' verified: '+result.report.site+' -> '+result.report.target+'; X='+result.report.x+'; CPU '+result.report.e+result.report.m+result.report.x8+result.report.c);
 }catch(ex){console.error('Forja65 indexed flow rejected: '+ex.message);process.exitCode=2;}
}
module.exports={verify};
