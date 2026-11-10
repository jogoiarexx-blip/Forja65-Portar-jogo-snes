#!/usr/bin/env node
'use strict';
// Independent check that an A/B input experiment changes no controls before
// the declared intervention frame. Does not validate the gameplay itself.
const fs=require('node:fs');
function parse(text){
  const header=text.match(/^#\s*FORJA65_INPUT_TRACE 1 rom=([0-9a-f]{16})\s*$/im);
  if(!header)throw Error('Missing/invalid ROM-bound trace header');
  const events=[];let last=-1;
  for(const line of text.split(/\r?\n/)){
    const l=line.trim();if(!l||l.startsWith('#'))continue;
    const m=l.match(/^frame=(\d+) joy1=([0-9a-f]{4}) joy2=([0-9a-f]{4})$/i);
    if(!m)throw Error('Invalid input trace event: '+l);
    const f=Number(m[1]);if(!Number.isSafeInteger(f)||f<=last)throw Error('Trace events must use increasing frame numbers');
    events.push({frame:f,joy1:m[2].toLowerCase(),joy2:m[3].toLowerCase()});last=f;
  }
  if(!events.length)throw Error('Empty input trace');
  return {rom:header[1].toLowerCase(),events};
}
function audit(base,variant,from){
  if(!Number.isSafeInteger(from)||from<0)throw Error('Invalid intervention frame');
  const a=parse(base),b=parse(variant);
  if(a.rom!==b.rom)throw Error('Different ROM fingerprints');
  const prefix=(x)=>x.events.filter(e=>e.frame<from);
  const pa=prefix(a),pb=prefix(b);
  const status=JSON.stringify(pa)===JSON.stringify(pb)?'PREFIX_IDENTICAL':'PREFIX_MISMATCH';
  return {schema:1,rom:a.rom,intervention_frame:from,status,baseline_prefix_events:pa.length,variant_prefix_events:pb.length,
  baseline_total_events:a.events.length,variant_total_events:b.events.length};
}
function cli(argv){
  const p={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])throw Error('Expected --argument value');p[argv[i].slice(2)]=argv[i+1];}
  if(!p.baseline||!p.variant||!p.from)throw Error('Usage: --baseline trace --variant trace --from FRAME [--out report.json]');
  const x=audit(fs.readFileSync(p.baseline,'utf8'),fs.readFileSync(p.variant,'utf8'),Number(p.from));
  if(p.out)fs.writeFileSync(p.out,JSON.stringify(x,null,2)+'\n');
  console.log(JSON.stringify(x,null,2));if(x.status!=='PREFIX_IDENTICAL')process.exitCode=2;
}
if(require.main===module){try{cli(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={parse,audit,cli};
