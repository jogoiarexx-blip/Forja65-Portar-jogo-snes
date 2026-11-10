#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const C=require('../forja65-core.js');
const project=path.resolve(process.argv[2]||'.');
const hintsPath=path.join(project,'analysis/runtime-hints.txt');
const romPath=path.join(project,'assets/cart-data.bin');
const dispatchPath=path.join(project,'src/dispatch.cpp');
if(![hintsPath,romPath,dispatchPath].every(fs.existsSync)) {console.error('Missing project ROM, hints, or dispatch.cpp');process.exit(2);}
const rom=C.loadRom(new Uint8Array(fs.readFileSync(romPath)),'cart-data.bin');
const hash=C.romFingerprint(rom);
const parsed=C.parseRuntimeHintsDetailed(fs.readFileSync(hintsPath,'utf8'));
const hints=parsed.hints;
const rejected=parsed.rejected;
const dispatch=fs.readFileSync(dispatchPath,'utf8');
// Require the exact CPU M/X/E state and either the observed carry or a
// deliberately carry-generic variant. Presence of an address alone was a
// false positive for DKC3 BB8564 (observed C=0, compiled only C=1).
const missing=rejected.map(r=>({kind:'INVALID_HINT',...r}));
if(hints.length===0)missing.push({kind:'NO_VALID_HINTS'});
let observedCovered=0,observedTotal=0;
let covered=0;
for(const h of hints){
 observedTotal+=h.observed||1;
 if(h.rom&&h.rom!==hash){missing.push({kind:'FINGERPRINT_MISMATCH',from:h.from,target:h.target});continue;}
 const hex=(h.target>>>0).toString(16).toUpperCase().padStart(6,'0');
 const rows=[...dispatch.matchAll(new RegExp('\\{0x'+hex+'u,(true|false),(true|false),(true|false),(true|false),(true|false),','g'))];
 if(!rows.length){missing.push({kind:'TARGET_NOT_DISPATCHED',from:h.from,target:h.target});continue;}
 const want=h.state;
 const bool=b=>b==='true';
 const matched=rows.some(m=>bool(m[1])===want.emulation&&bool(m[2])===want.m8&&bool(m[3])===want.x8&&(!bool(m[4])||bool(m[5])===want.carry));
 if(!matched){missing.push({kind:'CPU_STATE_NOT_DISPATCHED',from:h.from,target:h.target,observed:want,available:rows.slice(0,8).map(m=>({e:bool(m[1]),m:bool(m[2]),x:bool(m[3]),carryKnown:bool(m[4]),c:bool(m[5])}))});continue;}
 covered++;observedCovered+=h.observed||1;
}
const result={schema:'forja65.cfg-verification.v3',rom:hash,totalHints:hints.length,rejectedHints:rejected.length,covered,observedTotal,observedCovered,missing,passed:missing.length===0,limits:'Static CPU state presence only; no semantic or visual equivalence guarantee. Invalid hints and empty evidence fail closed.'};
fs.mkdirSync(path.join(project,'reports'),{recursive:true});
fs.writeFileSync(path.join(project,'reports/cfg-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
process.exitCode=result.passed?0:1;
