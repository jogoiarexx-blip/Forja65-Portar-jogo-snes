#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
// Observational PPU state only. Never infer actual rendered sprites/tiles.
function audit(csv){
 const lines=csv.trim().split(/\r?\n/),headers=lines.shift().split(','),idx=n=>headers.indexOf(n);
 for(const n of ['event','frame','inidisp','blank','brightness','bgmode','tm','ts'])if(idx(n)<0)throw new Error('missing field: '+n);
 const frames=[];for(const line of lines){if(!line.startsWith('frame,'))continue;const cols=line.split(',');const get=n=>Number(cols[idx(n)]);
 const id=get('inidisp'),forced=(id&0x80)!==0||get('blank')!==0,b=get('brightness'),main=get('tm'),sub=get('ts');
 const reason=forced?'forced_blank':b===0?'brightness_zero':main===0?'main_screen_disabled':(main&15)!==0?'background_enabled':(main&16)!==0?'obj_only':'other_layer';
 const frame=get('frame');if(!Number.isSafeInteger(frame)||frame<0)throw new Error('invalid PPU frame index');
 if(frames.length&&frame<=frames[frames.length-1].frame)throw new Error('PPU timeline contains overlapping runs: capture to a fresh directory before auditing');
 frames.push({frame,reason,bgmode:get('bgmode'),tm:main,ts:sub,brightness:b});}
 if(!frames.length)throw new Error('no frame rows');
 const counts=Object.create(null),first=Object.create(null),intervals=[];
 for(const f of frames){counts[f.reason]=(counts[f.reason]||0)+1;first[f.reason]??=f.frame;const last=intervals[intervals.length-1];if(last&&last.reason===f.reason&&last.end+1===f.frame){last.end=f.frame;}else intervals.push({start:f.frame,end:f.frame,reason:f.reason});}
 return {schema:'forja65.ppu-visibility-audit.v1',sampledFrames:frames.length,firstSampledFrame:frames[0].frame,lastSampledFrame:frames[frames.length-1].frame,counts,first,intervals,limits:'PPU enablement states are candidates, not pixel-level proof of visible graphics or correct PPU emulation.'};
}
if(require.main===module){try{const result=audit(fs.readFileSync(process.argv[2],'utf8'));if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={audit};
