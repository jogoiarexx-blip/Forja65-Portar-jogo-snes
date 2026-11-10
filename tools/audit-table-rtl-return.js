#!/usr/bin/env node
'use strict';
/*
 * RIE: authenticate a ROM/table-constructed RTL frontier seen in an actual
 * native replay. Evidence audit only; never whitelist a stack target, mutate
 * the native return stack, or declare a trace-observed destination executable.
 * CPU trace register transitions prove the values supplied to PHA/PLB; they
 * do not independently prove the nativeReturns bookkeeping.
 */
const fs=require('fs'),crypto=require('crypto');
const Core=require('../forja65-core');
const canon=x=>x.toString(16).toUpperCase().padStart(6,'0');
const decodeTrace=text=>String(text).split(/\r?\n/).map(line=>{
 const m=/^([\da-f]{6})\s+(.*)$/i.exec(line.trim());
 if(!m)return null;
 const regs={};for(const [,k,v] of m[2].matchAll(/(?:^|\s)(A|X|Y|S|DB|PB|E|M|X8|C)=([0-9a-f]+)(?=\s|$)/ig))regs[k.toUpperCase()]=parseInt(v,16);
 return {pc:parseInt(m[1],16),regs};
}).filter(Boolean);
function audit(raw,traceText,hintsText,errorText,from,target){
 const rom=Core.loadRom(new Uint8Array(raw));
 if(rom.header.mapping!=='HiROM')throw Error('Table RTL audit requires HiROM');
 const fingerprint=Core.romFingerprint(rom),sha256=crypto.createHash('sha256').update(raw).digest('hex');
 if(!Number.isInteger(from)||!Number.isInteger(target)||from<0||from>0xffffff||target<0||target>0xffffff)throw Error('Invalid address');
 const at=pc=>{const off=Core.snesToRom(rom,pc);if(off===null||off>=rom.data.length)throw Error('Unmapped ROM address '+canon(pc));return rom.data[off];};
 const pattern=[[0xBBB8D5,0xB9],[0xBBB8D8,0x48],[0xBBB8D9,0xAB],[0xBBB8DA,0xB9],[0xBBB8DD,0x48],[0xBBB8EB,0x6B]];
 if(from!==0xBBB8EB||pattern.some(([pc,opcode])=>at(pc)!==opcode)||
    at(0xBBB8D6)!==0x04||at(0xBBB8D7)!==0x00||
    at(0xBBB8DB)!==0x02||at(0xBBB8DC)!==0x00)throw Error('ROM does not contain the authenticated table-RTL opcode chain');
 const hint=new RegExp('^rom='+fingerprint+' target='+canon(target).toLowerCase()+' from='+canon(from).toLowerCase()+' kind=FLOW e=([01]) m=([01]) x=([01]) c=([01])\\s*$','gim');
 const matches=[...String(hintsText).matchAll(hint)];
 if(matches.length!==1)throw Error('Missing or ambiguous ROM-matched FLOW hint');
 const err=[...String(errorText).matchAll(/fluxo CFG nao resolvido em pc=(\d+) target=(\d+)/gi)].at(-1);
 if(!err||Number(err[1])!==from||Number(err[2])!==target)throw Error('Last error differs from this return');
 const trace=decodeTrace(traceText);
 if(!trace.length||trace.at(-1).pc!==from)throw Error('Trace does not end at observed RTL');
 // Select the last occurrence of each sequential landmark in the executed
 // trace, never an unrelated older pass through the same shared ROM labels.
 const found=new Map();let end=trace.length;
 for(let i=pattern.length-1;i>=0;i--){
  const pc=pattern[i][0];let k=end-1;
  while(k>=Math.max(0,trace.length-160)&&trace[k].pc!==pc)k--;
  if(k<0||k<Math.max(0,trace.length-160))throw Error('Incomplete RTL construction trace at '+canon(pc));
  found.set(pc,trace[k]);end=k;
 }
 const r=pc=>found.get(pc).regs;
 const field=(pc,name)=>{const value=r(pc)[name];if(!Number.isInteger(value))throw Error('Missing '+name+' at '+canon(pc));return value;};
 const final=r(from),observed={e:field(from,'E'),m:field(from,'M'),x:field(from,'X8'),c:field(from,'C')};
 if(Object.values(observed).some(v=>v!==0&&v!==1)||
   Object.keys(observed).some((k,i)=>observed[k]!==Number(matches[0][i+1]))||
   observed.e||observed.m||observed.x)throw Error('CPU width/state disagrees with native-mode 16-bit table RTL');
 const bankWord=field(0xBBB8D8,'A'),addressWord=field(0xBBB8DD,'A');
 const bank=bankWord&0xff;
 if((bankWord>>>8)!==bank||bank!==field(from,'DB')||
    bank!==field(0xBBB8DA,'DB')||field(from,'PB')!==(from>>>16)||
    field(0xBBB8D8,'S')!==field(0xBBB8D5,'S')||
    field(0xBBB8DA,'S')!==field(0xBBB8D8,'S')-1||
    field(0xBBB8DD,'S')!==field(0xBBB8DA,'S')||
    field(from,'S')!==field(0xBBB8DD,'S')-2)throw Error('Stack/register transitions do not prove constructed bank and return word');
 if((bank<<16 | ((addressWord+1)&0xffff))!==target)throw Error('RTL destination does not match pushed word + bank');
 at(target);
 return {schema:'forja65.table-rtl-observed-frontier.v1',rom_sha256:sha256,rom_fingerprint:fingerprint,
  observed:{source:canon(from),target:canon(target),state:observed,bank_word:bankWord.toString(16).toUpperCase().padStart(4,'0'),
   pushed_return_word:addressWord.toString(16).toUpperCase().padStart(4,'0'),stack_at_rtl:field(from,'S').toString(16).toUpperCase().padStart(4,'0'),
   final_trace_verified:true,kind:'FLOW',target_first_opcode:at(target).toString(16).toUpperCase().padStart(2,'0')},
  opcode_chain:pattern.map(([pc,op])=>({pc:canon(pc),opcode:op.toString(16).toUpperCase().padStart(2,'0')})),
  evidence:{rom_identity:true,rom_opcodes:true,exact_hint:true,exact_error:true,stack_register_transitions:true},
  limitations:['Not a nativeReturns token proof','Does not authorize arbitrary RTL targets','Does not establish runtime fidelity or extra completed frames']};
}
if(require.main===module){
 try{
  const [rom,trace,hints,error,rawFrom,rawTarget,out]=process.argv.slice(2);
  if(!out||![rawFrom,rawTarget].every(s=>/^(?:0x)?[\da-f]{6}$/i.test(s||'')))throw Error('Usage: audit-table-rtl-return.js ROM TRACE HINTS LAST_ERROR RTL_PC DESTINATION REPORT_JSON');
  const result=audit(fs.readFileSync(rom),fs.readFileSync(trace,'utf8'),fs.readFileSync(hints,'utf8'),fs.readFileSync(error,'utf8'),parseInt(rawFrom.replace(/^0x/i,''),16),parseInt(rawTarget.replace(/^0x/i,''),16));
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log('TABLE_RTL_AUDIT_PASS '+result.observed.source+' -> '+result.observed.target+'; no return guard bypass');
 }catch(e){console.error('TABLE_RTL_AUDIT_REJECTED:',e.message);process.exitCode=2;}
}
module.exports={audit};
