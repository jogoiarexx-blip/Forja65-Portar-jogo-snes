#!/usr/bin/env node
'use strict';
// Select only handlers for the requested target, rejecting duplicate or
// incomplete function boundaries before they can enter the real port.
function extractTargetHandlers(shards,target){
 if(!/^[0-9A-F]{6}$/.test(target)||!Array.isArray(shards)||!shards.length)throw Error('Invalid target or shard list');
 const selected=[],seen=new Set();
 for(const source of shards){
  const start=[...source.matchAll(/^void (sub_[0-9A-F]{6}_[A-Za-z0-9_]+)\(CpuState&/gm)];
  if(!start.length||source.slice(0,start[0].index).trim()!=='#include "generated.hpp"')throw Error('Unexpected generated shard preamble');
  for(let i=0;i<start.length;i++){
   const name=start[i][1];
   if(!name.startsWith('sub_'+target+'_'))continue;
   if(seen.has(name))throw Error('Duplicate target handler '+name);
   seen.add(name);
   const body=source.slice(start[i].index,i+1<start.length?start[i+1].index:source.length);
   const cases=[...body.matchAll(/case 0x([0-9A-F]{6})u: goto L_([0-9A-F]{6});/g)];
   const labels=[...body.matchAll(/^L_([0-9A-F]{6}):/gm)];
   if(!cases.length||!cases.some(m=>m[1]===target)||cases.some(m=>m[1]!==m[2])||
     new Set(cases.map(m=>m[1])).size!==cases.length||
     cases.length!==labels.length||
     cases.some(m=>!labels.some(x=>x[1]===m[1])))throw Error('Malformed target handler control flow '+name);
   selected.push(body);
  }
 }
 if(!selected.length)throw Error('Target missing from generated shards');
 return '#include "generated.hpp"\n'+selected.join('');
}
module.exports={extractTargetHandlers};
