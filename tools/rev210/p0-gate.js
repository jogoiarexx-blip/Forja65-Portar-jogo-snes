'use strict';
// Run all generator compile regressions that failed on the unmodified REV210,
// plus the new opt-in WRAM dump and strict forensic analyzer unit tests.
const cp=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const js=[
  'audio-spc-default-rev195-regression.js',
  'rev197-apu-access-timing-regression.js',
  'rev196-dsp-phase-mapping-regression.js',
  'ppu-mode7-latch-v0433-regression.js',
  'rev210-wram-raw-generation-regression.js',
];
let failures=0;
for(const name of js){
  process.stdout.write('\n[P0] '+name+'\n');
  const r=cp.spawnSync(process.execPath,[path.join(root,'tests',name)],{cwd:root,stdio:'inherit'});
  if(r.error||r.status!==0){failures++;console.error('FAIL',name,r.error?r.error.message:r.status);}
}
let py=null;
for(const command of [process.env.PYTHON,'python3','python'].filter(Boolean)){
  const r=cp.spawnSync(command,['--version'],{encoding:'utf8'});
  if(!r.error&&r.status===0){py=command;break;}
}
if(!py){failures++;console.error('FAIL: Python 3 unavailable, WRAM correlator not tested');}
else{
  const name='tests/test_rev210_wram_first_divergence.py';
  process.stdout.write('\n[P0] '+name+'\n');
  const r=cp.spawnSync(py,['-m','unittest','tests.test_rev210_wram_first_divergence','-v'],{cwd:root,stdio:'inherit'});
  if(r.error||r.status!==0){failures++;console.error('FAIL',name,r.error?r.error.message:r.status);}
}
process.stdout.write('\nREV210_P0_GATE '+(failures?'FAIL '+failures:'PASS')+'\n');
process.exitCode=failures?1:0;
