#!/usr/bin/env node
'use strict';
// Generates a *static candidate* from a ROM-confirmed indexed JMP and an
// externally observed X. Does not claim the destination was executed.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const Core=require('../forja65-core.js');
const {extractTargetHandlers}=require('./indexed-target-shard.js');
const {verify}=require('./verify-generated-rom.js');
const {directCalls}=require('./indexed-direct-calls.js');
const [romFile,auditFile,outDir,stateText]=process.argv.slice(2);
if(!romFile||!auditFile||!outDir||!stateText||!/^[01]{4}$/.test(stateText)){
 console.error('Usage: node generate-indexed-jmp-target.js ROM.bin audit.json OUT E M X C (4 bits concatenated)');process.exit(2);
}
try{
 const bytes=fs.readFileSync(romFile),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const proof=JSON.parse(fs.readFileSync(auditFile,'utf8'));
 if(proof.schema!=='forja65.rom-indexed-jmp-audit.v1'||proof.mapper!=='HiROM'||proof.rom_sha256!==hash||proof.opcode!=='7C'||!Array.isArray(proof.routes)||proof.routes.length!==1)throw Error('Invalid/ambiguous indexed table proof');
 const site=parseInt(proof.callsite,16),x=parseInt(proof.routes[0].observed_x,16),target=parseInt(proof.routes[0].target,16);
 if(!Number.isInteger(site)||!Number.isInteger(target)||x<0||x>65535||site>>>16!==target>>>16)throw Error('Invalid same-bank indexed JMP target');
 const rom=Core.loadRom(new Uint8Array(bytes),path.basename(romFile));
 const at=(pc)=>{let off=Core.snesToRom(rom,pc);if(off===null||off>=rom.data.length)throw Error('Unmapped table/code location');return rom.data[off]};
 if(at(site)!==0x7c)throw Error('Source opcode changed');
 const base=at((site&0xff0000)|((site+1)&65535))|(at((site&0xff0000)|((site+2)&65535))<<8);
 const ptr=(base+x)&65535,bank=site&0xff0000;
 const resolved=bank|(at(bank|ptr)|(at(bank|((ptr+1)&65535))<<8));
 if(resolved!==target||proof.routes[0].target_first_opcode!==at(target).toString(16).toUpperCase().padStart(2,'0'))throw Error('Target pointer proof mismatch');
 const state={emulation:stateText[0]==='1',m8:stateText[1]==='1',x8:stateText[2]==='1',carry:stateText[3]==='1'};
 if(state.emulation&&(!state.m8||!state.x8))throw Error('Invalid E/M/X state');
 const hint={rom:Core.romFingerprint(rom),from:site,target,kind:'STATIC_INDEXED_JMP',state,observed:1};
 const analysis=Core.analyze(rom,2048,[hint]);
 const funcs=analysis.functions.filter(fn=>fn.start===target);
 if(!funcs.length)throw Error('Target not decoded');
 const files=Core.generateProject(rom,analysis);
 const key=target.toString(16).toUpperCase().padStart(6,'0');
 const shards=Object.entries(files).filter(([n,t])=>/^src\/generated_\d{3}\.cpp$/.test(n)&&t.includes('void sub_'+key+'_'));
 if(!shards.length)throw Error('Missing generated C++ target routine');
 fs.mkdirSync(outDir,{recursive:true});
 fs.writeFileSync(path.join(outDir,'dispatch.cpp'),files['src/dispatch.cpp']);
 fs.writeFileSync(path.join(outDir,'shard.cpp'),shards.map(([,t])=>t).join('\n'));
 // The large analysis shard can contain unrelated dependency functions.
 // Emit a *separate*, source-authenticated target-only artifact compatible
 // with integrate-generated-cfg.py; never import unrelated routines.
 const verifiedDir=path.join(outDir,'verified'),srcDir=path.join(verifiedDir,'src');
 const focused=extractTargetHandlers(shards.map(([,t])=>t),key);
 const provenance=verify(bytes,focused,key,Core.romFingerprint(rom));
 if(provenance.rom.sha256!==hash||provenance.rom_opcode_mismatches!==undefined&&provenance.rom_opcode_mismatches!==0)throw Error('Generated target provenance mismatch');
 fs.mkdirSync(srcDir,{recursive:true});
 const candidates=directCalls(focused,rom,Core.snesToRom);
 fs.writeFileSync(path.join(outDir,'direct-call-candidates.json'),JSON.stringify({schema:'forja65.static-direct-call-candidates.v1',rom_sha256:hash,root:key,executed:false,candidates},null,2)+'\n');
 fs.writeFileSync(path.join(srcDir,'generated_000.cpp'),focused);
 fs.writeFileSync(path.join(srcDir,'dispatch.cpp'),files['src/dispatch.cpp']);
 const staticProof={rom_sha256:hash,opcode:'7C',source:proof.callsite,observed_x:proof.routes[0].observed_x,
  table_address:proof.routes[0].table_address,target:proof.routes[0].target};
 fs.writeFileSync(path.join(verifiedDir,'rom-proof.json'),JSON.stringify({entry:key,rom:{sha256:hash},
  code_sha256:provenance.code_sha256,rom_opcode_mismatches:0,
  source_shards:[{name:'generated_000.cpp',sha256:provenance.code_sha256}],
  proof_type:'STATIC_INDEXED_JMP',static_indexed_proof:staticProof,
  limitations:'Static proof only: not a runtime replay, must preserve existing dispatch ownership.'},null,2)+'\n');
 fs.writeFileSync(path.join(outDir,'proof.json'),JSON.stringify({schema:1,rom:Core.romFingerprint(rom),routine:key,
  observed:[{target,from:site,kind:'STATIC_INDEXED_JMP',state}],
  static_indexed_proof:{rom_sha256:hash,opcode:'7C',source:proof.callsite,observed_x:proof.routes[0].observed_x,table_address:proof.routes[0].table_address,target:proof.routes[0].target},
  variants:funcs.length,decoded:funcs.map(fn=>({entryState:fn.entryState,entryPc:fn.start,pcs:fn.instructions.map(i=>i.pc),decodedNative:fn.instructions.filter(i=>i.status==='native').length})),
  warning:'ROM-derived candidate; not yet replay-observed.'},null,2)+'\n');
 console.log('STATIC_INDEXED_JMP_GENERATED target='+key+' variants='+funcs.length+' verified_target_only=true no-runtime-observation');
}catch(e){console.error('ERROR: '+e.message);process.exit(1)}
