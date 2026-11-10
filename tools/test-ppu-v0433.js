'use strict';
// Focused release verification; not a claim that all historical tests pass.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=[
 'ppu-mode7-latch-v0433-regression.js','ppu-bg-tile-regression.js',
 'timing-order-v0432-regression.js','dma-startup-v0432-regression.js',
 'busy-loop-interrupt-regression.js','dma-forensics-v0386-regression.js',
 'tetris-dma-vram-v0403-regression.js','tetris-ppu-dma-v0401-regression.js',
 'tetris-ppu-raster-v0402-regression.js','color-hdma-v0392-regression.js',
 'tetris-hdma-v0400-regression.js',
 'spc-postincrement-v0431-regression.js','spc-profile-v0431-regression.js','spc-arithmetic-v0431-regression.js','spc-reference-flags-v0431-regression.js',
 'wram-fill-v0430-regression.js','wram-transfer-v0430-regression.js','cfg-cache-v0430-regression.js',
 'wram-stores-interrupt-resume-regression.js','smw-wram-executable-mapping-regression.js',
 'wram-runtime-v026-regression.js','cpu-bank-carry-v0427-regression.js',
 'reset-vector-jml-trampoline-v0428-regression.js','cfg-cache-compatible-v0369-regression.js',
 'cfg-identical-suffix-regression.js','stable-shards-v0319-regression.js',
 'stack-return-lifetime-v0393-regression.js','redirected-call-continuation-v0393-regression.js',
 'dma-address-step-regression.js','ppu-brightness-lut-v027-regression.js',
 'tetris-spc-semantics-v0407-regression.js','tetris-spc-cycles-v0406-regression.js',
 'tetris-spc-strict-v0412-regression.js','tetris-spc-register-edges-v0413-regression.js',
 'tetris-spc-ipl-v0408-regression.js','tetris-spc-cpu-poll-runs-v0410-regression.js',
 'tetris-spc-poll-window-v0411-regression.js','spc-div-v0420-regression.js',
 'audio-dsp-fractional-clock-v025-regression.js','audio-dsp-brr-v025-regression.js'
];
const reportDir=path.join(root,'reports','validation-v0433');fs.mkdirSync(reportDir,{recursive:true});
const results=[];
for(const name of names){
 const start=Date.now();
 const result=cp.spawnSync(process.execPath,[path.join(root,'tests',name)],{cwd:root,encoding:'utf8',timeout:240000});
 const log=(result.stdout||'')+(result.stderr||'')+(result.error?'\n'+result.error.message:'');
 fs.writeFileSync(path.join(reportDir,name+'.log'),log);
 const passed=!result.error&&result.status===0;
 results.push({test:name,passed,exitCode:result.status,seconds:(Date.now()-start)/1000});
 console.log((passed?'PASS ':'FAIL ')+name);if(!passed)console.error(log.slice(-5000));
}
fs.writeFileSync(path.join(reportDir,'summary.json'),JSON.stringify({version:require('../forja65-core').VERSION,scope:'40 directed regressions; no commercial-ROM gameplay or Windows build',results},null,2)+'\n');
console.log(results.filter(r=>r.passed).length+'/'+results.length+' passed');
if(results.some(r=>!r.passed))process.exitCode=1;
