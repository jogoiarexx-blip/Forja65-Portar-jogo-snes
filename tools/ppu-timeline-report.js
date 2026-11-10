#!/usr/bin/env node
'use strict';
// SNES PPU register evidence, never a fabricated frame.
// A cleared forced-blank bit does not make an image visible when brightness=0.
const fs=require('fs'),path=require('path');
function report(csv){
 const lines=csv.trim().split(/\r?\n/),keys=lines.shift()?.split(',')||[];
 const needed=['event','frame','instruction','pc','port','value','inidisp','blank','brightness','bgmode','tm','ts'];
 if(!needed.every(k=>keys.includes(k)))throw new Error('Invalid PPU timeline columns');
 const events=lines.filter(Boolean).map((line,n)=>{const x=line.split(',');if(x.length!==keys.length)throw new Error('Invalid PPU timeline row '+(n+2));const e=Object.fromEntries(keys.map((k,i)=>[k,k==='event'?x[i]:Number(x[i])]));if(Object.entries(e).some(([k,v])=>k!=='event'&&!Number.isFinite(v)))throw new Error('Non-numeric PPU timeline row '+(n+2));return e;});
 function visibility(e){if(e.blank)return 'FORCED_BLANK';if(!e.brightness)return 'ZERO_BRIGHTNESS';if(!(e.tm|e.ts))return 'LAYERS_DISABLED';return 'DISPLAY_ENABLED_POSSIBLE';}
 function short(e){return e?{frame:e.frame,instruction:e.instruction,pc:'0x'+e.pc.toString(16).toUpperCase().padStart(6,'0')}:null;}
 const frames=events.filter(e=>e.event==='frame').map(e=>({frame:e.frame,instruction:e.instruction,pc:short(e).pc,inidisp:e.inidisp,forcedBlank:!!e.blank,brightness:e.brightness,bgmode:e.bgmode,tm:e.tm,ts:e.ts,visibility:visibility(e)}));
 const writes=events.filter(e=>e.event==='write');
 const first=(predicate)=>short(events.find(predicate));
 let blankSeen=false;const unblankAfterBlank=events.find(e=>{if(e.blank)blankSeen=true;return blankSeen&&!e.blank;});
 return {schema:'forja65.ppu-timeline-report.v2',totalEvents:events.length,registerWrites:writes.length,frameSamples:frames.length,firstUnblank:first(e=>!e.blank),firstUnblankAfterForcedBlank:short(unblankAfterBlank),firstLayerEnabled:first(e=>(e.tm|e.ts)!==0),firstBrightnessEnabled:first(e=>!e.blank&&e.brightness>0),firstVisibilityPossible:first(e=>visibility(e)==='DISPLAY_ENABLED_POSSIBLE'),firstVisibleFrameCandidate:short(events.find(e=>e.event==='frame'&&visibility(e)==='DISPLAY_ENABLED_POSSIBLE')),frames,limits:['Register state alone does not prove rendered pixels or video equivalence','Brightness=0 renders black even if forced blank is cleared and layers are enabled','An event between frame samples is not itself proof of a displayed frame']};
}
if(require.main===module){try{const input=process.argv[2]||'forja65-ppu-timeline.csv',out=process.argv[3]||'reports/ppu-timeline-report.json';const result=report(fs.readFileSync(input,'utf8'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log('PPU timeline: '+result.frameSamples+' frame samples, '+result.registerWrites+' writes; visibility candidates '+result.frames.filter(x=>x.visibility==='DISPLAY_ENABLED_POSSIBLE').length+'; report '+out);}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={report};
