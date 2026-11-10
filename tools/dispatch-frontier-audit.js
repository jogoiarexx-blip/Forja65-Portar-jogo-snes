#!/usr/bin/env node
'use strict';
// Read-only, ROM-bound audit of dynamically observed 65816 control-flow edges.
// IMPORTANT: this does not teach the CFG or add speculative dispatch targets.
const fs = require('node:fs');
const path = require('node:path');

function parseOptions(argv) {
  const o = {strict:false};
  for (let i=0; i<argv.length; ++i) {
    const arg=argv[i];
    if (arg==='--strict') { o.strict=true; continue; }
    if (!['--project','--out','--from'].includes(arg) || i+1===argv.length) throw Error('Unknown or incomplete option: '+arg);
    o[arg.slice(2)]=argv[++i];
  }
  if(!o.project)throw Error('Usage: dispatch-frontier-audit.js --project PATH [--from RUNTIME_BUILD_DIR] [--out PATH] [--strict]');
  o.project=path.resolve(o.project);
  o.out=path.resolve(o.out||path.join(o.project,'analysis/dispatch-frontier-audit.json'));
  if(o.from)o.from=path.resolve(o.from);
  return o;
}
function parseHint(line) {
  const m=String(line).match(/^rom=([0-9a-f]{16}) target=([0-9a-f]{6}) from=([0-9a-f]{6}) kind=([A-Z][A-Z0-9-]*) e=([01]) m=([01]) x=([01]) c=([01])(?: observed=(\d+))?$/i);
  if(!m)return null;
  return {rom:m[1].toLowerCase(),target:parseInt(m[2],16),from:parseInt(m[3],16),kind:m[4].toUpperCase(),e:m[5]==='1',m:m[6]==='1',x:m[7]==='1',c:m[8]==='1',observed:Number(m[9]||1)};
}
function parseDispatch(source) {
  const map=new Map();
  // Actual C++ dispatch entries, not mere declarations or speculative knowledge.
  const re=/^\{0x([0-9A-Fa-f]{6})u,(true|false),(true|false),(true|false),(true|false),(true|false),&/gm;
  let m;
  while((m=re.exec(source))!==null){
    const address=parseInt(m[1],16),variant={e:m[2]==='true',m:m[3]==='true',x:m[4]==='true',carryKnown:m[5]==='true',c:m[6]==='true'};
    if(!map.has(address))map.set(address,[]);
    map.get(address).push(variant);
  }
  return map;
}
function variantMatches(variant,hint) {
  return variant.e===hint.e && variant.m===hint.m && variant.x===hint.x && (!variant.carryKnown || variant.c===hint.c);
}
function audit(hints,dispatch,rom) {
  const sites=new Map(),missing=[];let validated=0, stale=0,malformed=0;
  for(const [index,line] of hints.split(/\r?\n/).entries()){
    if(!line.trim()||line.startsWith('#'))continue;
    const h=parseHint(line.trim());if(!h){malformed++;continue;}
    if(h.rom!==rom){stale++;continue;}
    const variants=dispatch.get(h.target)||[];
    const match=variants.some(v=>variantMatches(v,h));
    const rec={from:'$'+h.from.toString(16).toUpperCase().padStart(6,'0'),target:'$'+h.target.toString(16).toUpperCase().padStart(6,'0'),kind:h.kind,
      e:Number(h.e),m:Number(h.m),x:Number(h.x),c:Number(h.c),observed:h.observed,decoded_variants:variants.length,callable_variant:match};
    if(!sites.has(rec.from))sites.set(rec.from,[]);
    sites.get(rec.from).push(rec);
    if(match)validated++;else missing.push({...rec,line:index+1});
  }
  const bySite=[...sites.entries()].map(([from,rows])=>({from,observed_edges:rows.length,callable:rows.filter(r=>r.callable_variant).length,unresolved:rows.filter(r=>!r.callable_variant).length,edges:rows})).sort((a,b)=>b.observed_edges-a.observed_edges||a.from.localeCompare(b.from));
  return {schema:'forja65.dispatch-frontier.v1',rom,observed_edges:validated+missing.length,callable_edges:validated,unresolved_edges:missing.length,stale_rom_hints:stale,malformed_hint_lines:malformed,sites:bySite,missing,
    caveat:'Dispatch-table variant coverage is necessary but not sufficient for correct runtime execution or gameplay. This audit never updates ROM, hints, or generated code.'};
}
// Audit the runtime's *latest* evidence as well as the project's accumulated
// learned hints. Without this comparison a green historical audit can mask a
// newly crashed, never-learned CFG destination. This audit remains read-only.
function auditRuntimeEvidence(runtimeHints,learnedHints,dispatch,rom) {
  const learned=new Set();
  const key=h=>[h.rom,h.from,h.target,h.kind,Number(h.e),Number(h.m),Number(h.x),Number(h.c)].join(':');
  for(const raw of learnedHints.split(/\r?\n/)) {
    const h=parseHint(raw.trim());if(h&&h.rom===rom)learned.add(key(h));
  }
  const seen=new Set(),pending=[],compiled=[],invalid=[],excludedNonRom=[];let stale=0;
  for(const [i,raw] of runtimeHints.split(/\r?\n/).entries()) {
    const line=raw.trim();if(!line||line.startsWith('#'))continue;
    const h=parseHint(line);
    if(!h){
      // Old runtimes sometimes reported an actual WRAM trampoline as a short
      // address (e.g. target=3e at $00:003E). Classify it separately: such
      // targets are never legitimate ROM callbacks to add to a native CFG.
      const short=line.match(/^rom=([0-9a-f]{16}) target=([0-9a-f]{1,5}) from=([0-9a-f]{6}) kind=[A-Z0-9-]+ e=[01] m=[01] x=[01] c=[01](?: observed=\d+)?$/i);
      if(short && short[1].toLowerCase()===rom && Number.parseInt(short[2],16)<0x8000){excludedNonRom.push({line:i+1,target:'$'+short[2].toUpperCase().padStart(6,'0')});continue;}
      invalid.push(i+1);continue;
    }
    if(h.rom!==rom){stale++;continue;}
    const k=key(h);if(seen.has(k))continue;seen.add(k);
    const row={line:i+1,from:'$'+h.from.toString(16).toUpperCase().padStart(6,'0'),target:'$'+h.target.toString(16).toUpperCase().padStart(6,'0'),kind:h.kind,
      learned:learned.has(k),callable:(dispatch.get(h.target)||[]).some(v=>variantMatches(v,h))};
    if(!row.learned)pending.push(row);
    if(!row.callable)compiled.push(row);
  }
  return {unique_observed:seen.size,unlearned:pending.length,uncompiled:compiled.length,stale_rom_hints:stale,malformed_lines:invalid,excluded_non_rom:excludedNonRom,
    pending,missing_compiled_variants:compiled,
    caveat:'Runtime evidence is not a verification of gameplay. All pending flow edges must be learned from runtime evidence, never guessed.'};
}
function main(o){
  const generation=JSON.parse(fs.readFileSync(path.join(o.project,'analysis/generation-options.json'),'utf8'));
  if(!/^[0-9a-f]{16}$/i.test(generation.rom))throw Error('Invalid ROM fingerprint in generation options');
  const rom=generation.rom.toLowerCase();
  const hintText=fs.readFileSync(path.join(o.project,'analysis/runtime-hints.txt'),'utf8');
  const dispatchText=fs.readFileSync(path.join(o.project,'src/dispatch.cpp'),'utf8');
  const compiled=parseDispatch(dispatchText);
  const result=audit(hintText,compiled,rom);
  if(o.from){
    const evidenceFile=path.join(o.from,'forja65-runtime-hints.txt');
    const evidence=fs.readFileSync(evidenceFile,'utf8');
    result.runtime_evidence=auditRuntimeEvidence(evidence,hintText,compiled,rom);
  }
  fs.mkdirSync(path.dirname(o.out),{recursive:true});fs.writeFileSync(o.out,JSON.stringify(result,null,2)+'\n');
  console.log('ROM '+rom+'; observed='+result.observed_edges+' callable='+result.callable_edges+' missing='+result.unresolved_edges+' stale='+result.stale_rom_hints+' malformed='+result.malformed_hint_lines);
  if(result.runtime_evidence){const x=result.runtime_evidence;console.log('Runtime: unique='+x.unique_observed+' unlearned='+x.unlearned+' uncompiled='+x.uncompiled+' stale='+x.stale_rom_hints+' malformed='+x.malformed_lines.length+' nonrom='+x.excluded_non_rom.length);}
  console.log('Audit: '+o.out);
  const pending=result.runtime_evidence&&(result.runtime_evidence.unlearned||result.runtime_evidence.uncompiled||result.runtime_evidence.stale_rom_hints||result.runtime_evidence.malformed_lines.length);
  return o.strict&&(result.unresolved_edges||result.stale_rom_hints||result.malformed_hint_lines||pending)?2:0;
}
if(require.main===module){try{process.exitCode=main(parseOptions(process.argv.slice(2)));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={parseOptions,parseHint,parseDispatch,variantMatches,audit,auditRuntimeEvidence,main};
