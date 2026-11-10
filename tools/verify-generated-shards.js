#!/usr/bin/env node
'use strict';
// Forja65 multi-shard provenance: verify all emitted opcode traces against
// the exact ROM and authenticate every C++ fragment before integration.
const fs=require('fs'),crypto=require('crypto');
const {verify}=require('./verify-generated-rom.js');
function verifyShards(romPath, entry, fingerprint, output, sources){
 if(sources.length<2)throw Error('Expected two or more shards');
 const unique=new Set(sources.map(s=>require('path').basename(s)));
 if(unique.size!==sources.length)throw Error('Duplicate source basename');
 const bodies=sources.map(s=>fs.readFileSync(s,'utf8'));
 const proof=verify(fs.readFileSync(romPath),bodies.join('\n'),entry,fingerprint);
 proof.source_shards=sources.map((s,i)=>({name:require('path').basename(s),
   sha256:crypto.createHash('sha256').update(bodies[i]).digest('hex')}));
 proof.scope+=' All shards authenticated, but runtime correctness not asserted.';
 fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n');
 return proof;
}
if(require.main===module){
 try{const [rom,entry,fp,output,...files]=process.argv.slice(2);
  if(!rom||!entry||!fp||!output||files.length<2)throw Error('Usage: verify-generated-shards.js rom entry fingerprint report shard0 shard1 ...');
  let p=verifyShards(rom,entry,fp,output,files);
  console.log(`PASS ${entry}: ${files.length} shards, ${p.unique_rom_opcodes} ROM sites`);
 }catch(e){console.error('Multi-shard verification failed:',e.message);process.exitCode=2;}
}
module.exports={verifyShards};
