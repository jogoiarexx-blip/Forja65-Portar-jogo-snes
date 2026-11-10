#!/usr/bin/env node
'use strict';
// Focused ROM-backed 65C816 emitter: requires a concrete crash observation.
// Does not invent a state or bypass gameplay; emits code for guarded merge.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Core=require('../forja65-core.js');
const [romFile,hintsFile,rawTarget,outFolder,...flags]=process.argv.slice(2);
const exportVerified=flags.includes('--verified-target');
const requireDirectJsr=flags.includes('--require-direct-jsr');
if(requireDirectJsr&&!exportVerified){console.error('--require-direct-jsr needs --verified-target');process.exit(2);}
const staticSite=flags.includes('--static-jsr');
const tableRtlPos=flags.indexOf('--table-rtl-evidence');
const tableRtlFiles=tableRtlPos>=0?flags.slice(tableRtlPos+1,tableRtlPos+3):null;
const indexedPos=flags.indexOf('--indexed-proof');
const indexedProofFile=indexedPos>=0?flags[indexedPos+1]:null;
const indexedJsrPos=flags.indexOf('--indexed-jsr-proof');
const indexedJsrProofFile=indexedJsrPos>=0?flags[indexedJsrPos+1]:null;
const directJslProofPos=flags.indexOf('--direct-jsl-proof');
const directJslProofFile=directJslProofPos>=0?flags[directJslProofPos+1]:null;
const dpProofPos=flags.indexOf('--dp-jmp-proof');
const dpProofFile=dpProofPos>=0?flags[dpProofPos+1]:null;
const recognized=flags.filter((arg,i)=>arg!=='--static-jsr'&&arg!=='--verified-target'&&arg!=='--require-direct-jsr'&&arg!=='--indexed-proof'&&!(indexedPos>=0&&i===indexedPos+1)&&arg!=='--indexed-jsr-proof'&&!(indexedJsrPos>=0&&i===indexedJsrPos+1)&&arg!=='--dp-jmp-proof'&&!(dpProofPos>=0&&i===dpProofPos+1)&&arg!=='--direct-jsl-proof'&&!(directJslProofPos>=0&&i===directJslProofPos+1)&&arg!=='--table-rtl-evidence'&&!(tableRtlPos>=0&&(i===tableRtlPos+1||i===tableRtlPos+2)));
if(recognized.length){console.error('Unknown option: '+recognized.join(', '));process.exit(2);}
if((directJslProofPos>=0&&(!directJslProofFile||!exportVerified||staticSite||indexedPos>=0||indexedJsrPos>=0||dpProofPos>=0||tableRtlPos>=0||requireDirectJsr))||(dpProofPos>=0&&(!dpProofFile||!exportVerified||staticSite||indexedPos>=0||indexedJsrPos>=0||tableRtlPos>=0||requireDirectJsr))||(indexedJsrPos>=0&&(!indexedJsrProofFile||!exportVerified||staticSite||tableRtlPos>=0||indexedPos>=0||requireDirectJsr))||(indexedPos>=0&&(!indexedProofFile||staticSite||tableRtlPos>=0))||(requireDirectJsr&&(staticSite||indexedPos>=0||tableRtlPos>=0))||(tableRtlPos>=0&&(!exportVerified||staticSite||tableRtlFiles.length!==2||tableRtlFiles.some(x=>!x)))){
 console.error('Usage: [--static-jsr] OR [--indexed-proof file] OR [--verified-target --require-direct-jsr] OR [--verified-target --table-rtl-evidence TRACE LAST_ERROR] OR [--verified-target --dp-jmp-proof JSON]');process.exit(2);
}
if(!romFile||!hintsFile||!rawTarget||!outFolder){console.error('Usage: node tools/generate-observed-flow.js game.sfc runtime-hints.txt C0F923 output-dir');process.exit(2);}
try {
const target=rawTarget.replace(/^(?:0x|\$)/i,'').replace(':','').toUpperCase();
if(!/^[0-9A-F]{6}$/.test(target))throw Error('Invalid 24-bit target');
const rawRom=fs.readFileSync(romFile);
let staticEvidence=null;
if(staticSite){
  staticEvidence=JSON.parse(fs.readFileSync(hintsFile,'utf8'));
  if(staticEvidence.schema!==1||staticEvidence.kind!=='STATIC_JSR_SITE'||staticEvidence.target!==target)throw Error('Missing verified static-JSR target');
  const sha=crypto.createHash('sha256').update(rawRom).digest('hex');
  if(staticEvidence.rom_sha256!==sha)throw Error('Static JSR ROM SHA256 mismatch');
  const caller=parseInt(staticEvidence.caller,16),dest=parseInt(target,16),off=staticEvidence.physical_offset;
  if(!Number.isInteger(off)||off<0||off+3>rawRom.length||caller>>>16!==dest>>>16||
      rawRom[off]!==0x20||rawRom[off+1]!==((dest)&255)||rawRom[off+2]!==((dest>>>8)&255)||
      staticEvidence.opcode!==rawRom.subarray(off,off+3).toString('hex'))throw Error('Static JSR opcode/target proof mismatch');
  const states=staticEvidence.possible_entry_states;
  if(!Array.isArray(states)||!states.length||states.some(st=>['e','m','x','c'].some(k=>st[k]!==0&&st[k]!==1)))throw Error('Invalid static JSR state candidates');
}
const rom=Core.loadRom(new Uint8Array(rawRom),path.basename(romFile)),hash=Core.romFingerprint(rom);
let directJslEvidence=null;
if(directJslProofFile){
 const p=JSON.parse(fs.readFileSync(directJslProofFile,'utf8'));
 const sha=crypto.createHash('sha256').update(rawRom).digest('hex');
 const src=parseInt(p.source,16),dest=parseInt(p.target,16);
 const off=Core.snesToRom(rom,src);
 const state=p.cpu_state;
 const verified=p.evidence&&['rom_opcode','trace_last_pc','cpu_flags','runtime_hint','last_error'].every(k=>p.evidence[k]===true);
 const op=off===null?null:rom.data.subarray(off,off+4);
 if(p.schema!=='forja65.direct-jsl-frontier.v1'||p.status!=='JSL_ROM_TRACE_ERROR_CROSSCHECKED'||p.mapper!=='HiROM'||
    p.rom_sha256!==sha||p.rom_fingerprint!==hash||!verified||!state||
    !['e','m','x','c'].every(k=>state[k]===0||state[k]===1)||
    !Number.isInteger(src)||!Number.isInteger(dest)||dest!==parseInt(target,16)||
    src<0x800000||dest<0x800000||(src&65535)>65531||
    !op||op.length!==4||op[0]!==0x22||
    (op[1]|(op[2]<<8)|(op[3]<<16))!==dest||
    p.physical_offset!==off||p.opcode!==Array.from(op).map(v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' ')||
    p.return_pc!==(src+4).toString(16).toUpperCase().padStart(6,'0')||
    p.stack_return_word!==((src+3)&65535).toString(16).toUpperCase().padStart(4,'0'))
   throw Error('Direct JSL proof failed ROM/trace/state/return checks');
 directJslEvidence={source:src,target:dest,state,rom_sha256:sha,kind:'JSL_ABSOLUTE_LONG'};
}
let dpEvidence=null;
if(dpProofFile){
 const p=JSON.parse(fs.readFileSync(dpProofFile,'utf8'));
 const sha=crypto.createHash('sha256').update(rawRom).digest('hex');
 const src=parseInt(p.source,16),dest=parseInt(p.target,16);
 const get=(pc)=>{const off=Core.snesToRom(rom,pc);if(off===null||off>=rom.data.length)throw Error('DP JMP has unmapped opcode');return rom.data[off];};
 if(p.schema!=='forja65.dp-indirect-frontier.v1'||p.status!=='DP_JMP_LOCAL_WRITER_TRACE_ATTESTED'||p.mapper!=='HiROM'||p.rom_sha256!==sha||p.rom_fingerprint!==hash||
    !Number.isInteger(src)||!Number.isInteger(dest)||dest!==parseInt(target,16)||src>>>16!==dest>>>16||
    !p.cpu_state||!['e','m','x','c'].every(k=>p.cpu_state[k]===0||p.cpu_state[k]===1)||p.cpu_state.e!==0||p.cpu_state.m!==0||
    !p.evidence||!['rom_opcode','local_store_trace','pea_stack_trace','runtime_hint','last_error'].every(k=>p.evidence[k]===true)||
    p.store_site!==(src-5).toString(16).toUpperCase().padStart(6,'0')||p.pea_site!==(src-3).toString(16).toUpperCase().padStart(6,'0')||
    get(src)!==0x6c||get(src-5)!==0x85||get(src-3)!==0xf4||get(src-5+1)!==get(src+1)||get(src+2)!==0||
    p.pointer_absolute!==get(src+1).toString(16).toUpperCase().padStart(4,'0')||
    p.return_word!==(get(src-3+1)|(get(src-3+2)<<8)).toString(16).toUpperCase().padStart(4,'0')||
    p.return_word!==((src+2)&65535).toString(16).toUpperCase().padStart(4,'0')||
    p.written_value!==(dest&65535).toString(16).toUpperCase().padStart(4,'0'))
     throw Error('Dynamic DP JMP proof failed ROM/write/stack checks');
 dpEvidence={source:src,target:dest,state:p.cpu_state,vector:get(src+1),rom_sha256:sha,kind:'JMP_ABS_INDIRECT_DP_WRITE'};
}
let indexedEvidence=null;
if(indexedProofFile||indexedJsrProofFile){
 const proof=JSON.parse(fs.readFileSync(indexedProofFile||indexedJsrProofFile,'utf8'));
 const expectedSha=crypto.createHash('sha256').update(rawRom).digest('hex');
 const src=parseInt(proof.source,16),dest=parseInt(proof.target,16),x=parseInt(proof.observed_x,16);
 const expectedState=proof.cpu_state;
 const complete=proof.evidence&&['rom_opcode','cpu_trace_x','runtime_hint','last_error'].every(k=>proof.evidence[k]===true);
 const at=(pc)=>{let offset=Core.snesToRom(rom,pc);if(offset===null||offset>=rom.data.length)throw Error('Invalid indexed address');return rom.data[offset];};
 const isJsr=!!indexedJsrProofFile;
 if(proof.schema!==(isJsr?'forja65.indexed-jsr-trace-crosscheck.v1':'forja65.indexed-jmp-trace-crosscheck.v1')||proof.status!==(isJsr?'INDEXED_JSR_TARGET_ROM_AND_TRACE_CROSSCHECKED':'INDEXED_TARGET_ROM_AND_TRACE_CROSSCHECKED')||
    proof.mapper!=='HiROM'||!complete||proof.rom_sha256!==expectedSha||proof.rom_fingerprint!==hash||
    !Number.isInteger(src)||!Number.isInteger(dest)||!Number.isInteger(x)||x<0||x>65535||
    dest!==parseInt(target,16)||src>>>16!==dest>>>16||at(src)!==(isJsr?0xfc:0x7c)||
    !expectedState||!['e','m','x','c'].every(k=>expectedState[k]===0||expectedState[k]===1))
     throw Error('Indexed JMP proof invalid or bound to another ROM/route/state');
 const base=at((src&0xff0000)|((src+1)&0xffff))|(at((src&0xff0000)|((src+2)&0xffff))<<8);
 const ptr=(base+x)&0xffff,bank=src&0xff0000;
 if(isJsr&&(proof.return_pc!==(bank|((src+3)&0xffff)).toString(16).toUpperCase().padStart(6,'0')||
 proof.stack_return_word!==((src+2)&0xffff).toString(16).toUpperCase().padStart(4,'0')))throw Error('Indexed JSR return-site proof invalid');
 if(proof.pointer_base!==base.toString(16).toUpperCase().padStart(4,'0')||
    proof.pointer_at!==(bank|ptr).toString(16).toUpperCase().padStart(6,'0')||
    proof.pointer_bytes!==[at(bank|ptr),at(bank|((ptr+1)&0xffff))].map(v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' ')||
    (bank|at(bank|ptr)|(at(bank|((ptr+1)&0xffff))<<8))!==dest)throw Error('Indexed JMP ROM pointer proof changed');
 indexedEvidence={source:src,target:dest,x,state:expectedState,rom_sha256:expectedSha,kind:isJsr?'JSR_INDIRECT_X':'JMP_INDIRECT_X',...(isJsr?{return_pc:parseInt(proof.return_pc,16)}:{})};
}
let all;
if(staticSite){
  const states=staticEvidence.possible_entry_states;
  const hintText=states.map(st=>`rom=${hash} target=${target.toLowerCase()} from=${staticEvidence.caller.toLowerCase()} kind=FLOW e=${st.e} m=${st.m} x=${st.x} c=${st.c}`).join('\n');
  all=Core.parseRuntimeHints(hintText);
}else{
  all=Core.parseRuntimeHints(fs.readFileSync(hintsFile,'utf8'));
}
const real=all.filter(x=>x.rom===hash&&x.target===parseInt(target,16)&&['FLOW','STATE','STACK-RTL','STACK-RTS'].includes(x.kind));
let tableRtlEvidence=null;
if(tableRtlFiles){
 const hintText=fs.readFileSync(hintsFile,'utf8');
 const fromHints=all.filter(x=>x.rom===hash&&x.target===parseInt(target,16)&&x.kind==='FLOW'&&x.from===0xBBB8EB);
 if(fromHints.length!==1)throw Error('Table RTL must have exact ROM-bound runtime FLOW observation');
 tableRtlEvidence=require('./audit-table-rtl-return').audit(rawRom,fs.readFileSync(tableRtlFiles[0],'utf8'),hintText,fs.readFileSync(tableRtlFiles[1],'utf8'),0xBBB8EB,parseInt(target,16));
}

if(directJslEvidence&&!real.some(obs=>obs.from===directJslEvidence.source&&obs.kind==='FLOW'&&
 ['e','m','x','c'].every(k=>directJslEvidence.state[k]===({e:obs.state.emulation?1:0,m:obs.state.m8?1:0,x:obs.state.x8?1:0,c:obs.state.carry?1:0})[k])))
 throw Error('Direct JSL proof mismatches the ROM-bound runtime observation');
if(dpEvidence&&!real.some(obs=>obs.from===dpEvidence.source&&obs.kind==='FLOW'&&['e','m','x','c'].every(k=>dpEvidence.state[k]===({e:obs.state.emulation?1:0,m:obs.state.m8?1:0,x:obs.state.x8?1:0,c:obs.state.carry?1:0})[k])))throw Error('DP JMP proof does not match exact ROM-bound runtime state');
if(indexedEvidence&&!real.some(obs=>obs.from===indexedEvidence.source&&obs.kind==='FLOW'&&
 ['e','m','x','c'].every((k)=>indexedEvidence.state[k]===({e:obs.state.emulation?1:0,m:obs.state.m8?1:0,x:obs.state.x8?1:0,c:obs.state.carry?1:0})[k])))
 throw Error('Indexed JMP proof does not match runtime hint at exact CPU state');
// Opt-in: cross-check an observed direct JSR against the *current ROM*, not
// just a hint file. Do not invent a CPU state or accept a different callsite.
const {directJsrProof}=require('./observed-direct-jsr-proof.js');
const directJsr=[];
for(const obs of real){
 const match=directJsrProof(rom,obs.from,obs.target,Core.snesToRom);
 if(match)directJsr.push({...match,state:obs.state});
}
if(requireDirectJsr&&!directJsr.length)throw Error('No ROM-authenticated direct JSR from the observed runtime hint');
const stack=real.filter(x=>['STACK-RTL','STACK-RTS'].includes(x.kind));
let verifiedStackReturns=0;
if(stack.length){const logFile=path.join(path.dirname(hintsFile),'forja65-unresolved-returns.txt');const log=fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8'):'';verifiedStackReturns=require('./observed-stack-return').verifyObservedStackReturns(rom,stack,log);}
if(!real.length)throw Error('No matching ROM-bound observation; cannot guess CPU state');
const a=Core.analyze(rom,2048,real);
const funcs=a.functions.filter(x=>x.start===parseInt(target,16));
if(!funcs.length)throw Error('Forja65 could not decode observed target');
const files=Core.generateProject(rom,a); const candidates=Object.entries(files).filter(([n,t])=>/^src\/generated_\d{3}\.cpp$/.test(n)&&t.includes('void sub_'+target+'_'));
if(!candidates.length)throw Error('Generated function not emitted');
fs.mkdirSync(outFolder,{recursive:true});fs.writeFileSync(path.join(outFolder,'dispatch.cpp'),files['src/dispatch.cpp']);
const shard=candidates.map(([n,t])=>t).join('\n');fs.writeFileSync(path.join(outFolder,'shard.cpp'),shard);
const proof={schema:1,rom:hash,...(directJslEvidence?{direct_jsl_trace_crosscheck:directJslEvidence}:{}),...(dpEvidence?{dp_jmp_trace_crosscheck:dpEvidence}:{}),...(indexedEvidence?{indexed_trace_crosscheck:indexedEvidence}:{}),...(tableRtlEvidence?{table_rtl_evidence:tableRtlEvidence}:{}),observed:real.map(x=>({target:x.target,from:x.from,kind:staticSite?'STATIC_JSR':x.kind,state:x.state,...(staticSite?{state_source:'dispatcher_possible_not_runtime_measured'}:{})})),...(staticSite?{mapper:staticEvidence.mapper,static_site_rom_sha256:staticEvidence.rom_sha256}:{}),routine:target,verifiedStackReturns,variants:funcs.length,decoded:funcs.map(f=>({entryState:f.entryState,entryPc:f.start,pcs:f.instructions.map(x=>x.pc),decodedNative:f.instructions.filter(i=>i.status==='native').length}))};
fs.writeFileSync(path.join(outFolder,'proof.json'),JSON.stringify(proof,null,2)+'\n');
if(exportVerified){
 const {extractTargetHandlers}=require('./indexed-target-shard.js');
 const {verify}=require('./verify-generated-rom.js');
 const {directCalls}=require('./indexed-direct-calls.js');
 const focused=extractTargetHandlers(candidates.map(([,text])=>text),target);
 const attested=verify(rawRom,focused,target,hash);
 const dir=path.join(outFolder,'verified'),src=path.join(dir,'src');
 fs.mkdirSync(src,{recursive:true});
 fs.writeFileSync(path.join(src,'generated_000.cpp'),focused);
 fs.writeFileSync(path.join(src,'dispatch.cpp'),files['src/dispatch.cpp']);
 const candidatesForLater=directCalls(focused,rom,Core.snesToRom);
 fs.writeFileSync(path.join(outFolder,'direct-call-candidates.json'),JSON.stringify({schema:'forja65.static-direct-call-candidates.v1',rom_sha256:attested.rom.sha256,root:target,executed:false,candidates:candidatesForLater},null,2)+'\n');
 fs.writeFileSync(path.join(dir,'rom-proof.json'),JSON.stringify({entry:target,rom:{sha256:attested.rom.sha256},code_sha256:attested.code_sha256,rom_opcode_mismatches:0,
  source_shards:[{name:'generated_000.cpp',sha256:attested.code_sha256}],
  evidence_type:staticSite?'STATIC_JSR_CANDIDATE':requireDirectJsr?'OBSERVED_DIRECT_JSR':dpProofFile?'OBSERVED_DP_JMP_LOCAL_WRITER_TRACE':indexedJsrProofFile?'OBSERVED_INDEXED_JSR_ROM_TRACE':tableRtlEvidence?'OBSERVED_ROM_TABLE_RTL':'OBSERVED_FLOW',direct_jsr_rom_verified:directJsr,
  runtime_hint_source:path.basename(hintsFile),scope:'Static ROM opcode attestation; observed hint is not a replay certificate.'},null,2)+'\n');
}

console.log('Generated '+(staticSite?'verified static-JSR':'observed')+' '+target+': variants='+funcs.length+', PCs='+new Set(funcs.flatMap(f=>f.instructions.map(i=>i.pc))).size+', ROM='+hash);
}catch(err){console.error('ERROR: '+err.message);process.exit(1);}
