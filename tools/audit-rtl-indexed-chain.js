#!/usr/bin/env node
'use strict';
/**
 * Evidence-based prefetch for an observed RTL -> JMP (abs,X) chain.
 * The observed RTL target is runtime-proven. The next indexed destination is
 * static only until separately reached at runtime; NEVER treat it as observed.
 */
const fs=require('fs'),crypto=require('crypto');
const Core=require('../forja65-core');
function canonical(pc){return Number(pc).toString(16).toUpperCase().padStart(6,'0');}
function audit(raw,trace,hints,error,sourcePc,rtlTarget){
 const rom=Core.loadRom(new Uint8Array(raw));
 if(rom.header.mapping!=='HiROM')throw Error('Indexed generator proof currently requires HiROM mapping');
 const sha256=crypto.createHash('sha256').update(raw).digest('hex'), fingerprint=Core.romFingerprint(rom);
 const from=Number(sourcePc), at=Number(rtlTarget);
 if(![from,at].every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffff))throw Error('Invalid 24-bit source/target');
 const read=pc=>{const off=Core.snesToRom(rom,pc);if(off===null||off>=rom.data.length)throw Error('Target/pointer outside mapped ROM: '+canonical(pc));return rom.data[off];};
 if(read(from)!==0x6b||read(at)!==0x7c)throw Error('Source must be RTL and the observed target must be JMP (abs,X)');
 const rec=new RegExp('^rom='+fingerprint+' target='+canonical(at).toLowerCase()+' from='+canonical(from).toLowerCase()+' kind=FLOW e=([01]) m=([01]) x=([01]) c=([01])\\s*$','gim');
 const matches=[...String(hints).matchAll(rec)];
 if(!matches.length)throw Error('Missing ROM-matched runtime FLOW hint from exact RTL site');
 if(new Set(matches.map(h=>h.slice(1).join(''))).size!==1)throw Error('Ambiguous runtime FLOW states');
 const hint=matches[0];
 const err=[...String(error).matchAll(/fluxo CFG nao resolvido em pc=(\d+) target=(\d+)/gi)].at(-1);
 if(!err||Number(err[1])!==from||Number(err[2])!==at)throw Error('Latest runtime error does not corroborate this exact route');
 const instructions=String(trace).split(/\r?\n/).filter(line=>/^[0-9a-f]{6}\s/i.test(line));
 const last=instructions.at(-1);
 if(!last||!last.toLowerCase().startsWith(canonical(from).toLowerCase()+' '))throw Error('Latest CPU trace instruction must be RTL source');
 const field=(name)=>{const m=last.match(new RegExp('(?:^|\\s)'+name+'=([0-9a-f]+)(?=\\s|$)','i'));if(!m)throw Error('CPU trace missing '+name);return m[1]};
 const state={e:parseInt(field('E'),16),m:parseInt(field('M'),16),x:parseInt(field('X8'),16),c:parseInt(field('C'),16)};
 if([state.e,state.m,state.x,state.c].some(v=>v!==0&&v!==1)||['e','m','x','c'].some((key,i)=>state[key]!==Number(hint[i+1])))throw Error('CPU trace E/M/X/C differs from FLOW hint');
 if(state.e&&(!state.m||!state.x))throw Error('Inconsistent emulation widths');
 const x=parseInt(field('X'),16),stack=parseInt(field('S'),16);
 if((state.x&&x>255)||parseInt(field('PB'),16)!==(from>>>16))throw Error('Inconsistent CPU X width or program bank');
 if(!Number.isInteger(x)||x<0||x>0xffff||!Number.isInteger(stack)||stack>0xffff)throw Error('Invalid X or S in CPU trace');
 // RTL only modifies PB, PC and S. X and processor flags are unchanged.
 const bank=at&0xff0000;
 const base=read(bank|((at+1)&0xffff))|(read(bank|((at+2)&0xffff))<<8),pointer=(base+x)&0xffff;
 const b0=read(bank|pointer),b1=read(bank|((pointer+1)&0xffff));
 const candidate=bank|(b0|(b1<<8));read(candidate);
 return {schema:'forja65.rtl-indexed-chain.v1',rom_sha256:sha256,rom_fingerprint:fingerprint,
    observed:{rtl_from:canonical(from),rtl_target:canonical(at),frame_source:'cpu_trace',x:x.toString(16).toUpperCase().padStart(4,'0'),stack:stack.toString(16).toUpperCase().padStart(4,'0'),state,kind:'FLOW'},
    indexed:{opcode:'7C',pointer_base:base.toString(16).toUpperCase().padStart(4,'0'),pointer_at:canonical(bank|pointer),bytes:[b0,b1].map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' '),candidate:canonical(candidate),status:'STATIC_CANDIDATE_NOT_RUNTIME_OBSERVED'},
    indexed_generator_proof:{schema:'forja65.rom-indexed-jmp-audit.v1',mapper:'HiROM',rom_sha256:sha256,opcode:'7C',callsite:canonical(at),routes:[{observed_x:x.toString(16).toUpperCase().padStart(4,'0'),target:canonical(candidate),target_first_opcode:read(candidate).toString(16).toUpperCase().padStart(2,'0'),table_address:canonical(bank|pointer)}],source:'RTL trace with ROM-confirmed immediately-following indexed JMP; static candidate only'},
    evidence:{rom_opcodes:true,rom_identity:true,exact_runtime_hint:true,exact_last_error:true,rtl_registers_from_trace:true},
    limitations:'Neither stack provenance nor execution of the indexed candidate can be proven solely by this audit.'};
}
if(require.main===module){
 try{
  const [rom,trace,hints,error,from,target,out]=process.argv.slice(2);
  if(!out||!/^([\da-f]{6}|0x[\da-f]{6})$/i.test(from)||!/^([\da-f]{6}|0x[\da-f]{6})$/i.test(target))throw Error('Usage: node audit-rtl-indexed-chain.js ROM TRACE HINTS LAST_ERROR RTL_PC JMP_PC REPORT_JSON');
  const data=audit(fs.readFileSync(rom),fs.readFileSync(trace,'utf8'),fs.readFileSync(hints,'utf8'),fs.readFileSync(error,'utf8'),parseInt(from.replace(/^0x/i,''),16),parseInt(target.replace(/^0x/i,''),16));
  fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');
  fs.writeFileSync(out.replace(/\.json$/i,'')+'.indexed-proof.json',JSON.stringify(data.indexed_generator_proof,null,2)+'\n');
  console.log(JSON.stringify(data));
 }catch(e){console.error('AUDIT_REJECTED:',e.message);process.exitCode=2;}
}
module.exports={audit};
