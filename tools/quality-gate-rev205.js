#!/usr/bin/env node
'use strict';
// REV205: reproducible, fail-closed, per-subsystem regression gate.
// Never treats a passing unit test as evidence that a full game is native.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const checks=[
 ['MAPPER','tests/rom-mapping-rev194-regression.js'],
 ['CPU','tests/xce-state-v033-regression.js'],
 ['CPU','tests/unknown-carry-state-regression.js'],
 ['CFG','tests/cfg-global-native-v043695-regression.js'],
 ['CFG','tests/cfg-global-preservation-v043695-regression.js'],
 ['WRAM','tests/smw-wram-executable-mapping-regression.js'],
 ['DMA','tests/rev197-apu-access-timing-regression.js'],
 ['SPC700','tests/audio-spc-default-rev195-regression.js'],
 ['DSP','tests/audio-dsp-brr-v025-regression.js'],
 ['PPU','tests/rev198-video-filters-aspect-regression.js'],
 ['SRAM','tests/rev201-sram-input-regression.js'],
 ['RUNTIME','tests/rev204-observed-only-regression.js'],
 ['INPUT','tests/rev204-logic-dual-bwram-regression.js'],
];
const args=process.argv.slice(2);
// Extended checks are opt-in because some legacy test suites spawn large builds.
const selected=args.includes('--extended')?checks:checks.filter(x=>['rom-mapping-rev194','xce-state-v033','unknown-carry-state','cfg-global-preservation','smw-wram-executable-mapping','rev198-video-filters-aspect','rev201-sram-input'].some(n=>x[1].includes(n)));
const outputArg=args.indexOf('--output');
const output=outputArg>=0?args[outputArg+1]:path.join(root,'REV205-QUALITY-GATE.json');
if(!output || output.startsWith('--'))throw Error('Missing --output path');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const results=[];for(const [subsystem,rel] of selected){
 const full=path.join(root,rel);const item={subsystem,test:rel};
 if(!fs.existsSync(full)){item.status='MISSING';results.push(item);continue;}
 item.sha256=sha(full);
 const r=cp.spawnSync(process.execPath,[full],{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
 item.status=r.error?.code==='ETIMEDOUT'?'TIMEOUT':r.status===0?'PASS':'FAIL';
 item.exitCode=r.status;item.detail=((r.stdout||'')+'\n'+(r.stderr||'')).trim().slice(-2400);
 results.push(item);console.log(`${item.status.padEnd(8)} ${subsystem.padEnd(8)} ${rel}`);
}
const passing=results.filter(x=>x.status==='PASS').length;
const report={schema:1,revision:'REV205-quality-gate',node:process.version,coreSha256:sha(path.join(root,'forja65-core.js')),
 tested:results.length,passing,failed:results.length-passing,mode:args.includes('--extended')?'extended':'smoke',notExecuted:checks.filter(x=>!selected.includes(x)).map(x=>x[1]),results,
 certification:{fullGamePort:false,fullyNative:false,framesExecuted:null,instructionsNative:null,instructionsInterpreted:null,
 reason:'Unit/regression tests cannot certify game completion or 100% native execution; a ROM-bound end-to-end trace and differential results are required.'}};
fs.writeFileSync(path.resolve(output),JSON.stringify(report,null,2)+'\n');
console.log(`Quality gate: ${passing}/${results.length}; report=${path.resolve(output)}`);
if(passing!==results.length)process.exitCode=1;
