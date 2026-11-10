'use strict';
const assert=require('node:assert/strict'),cp=require('node:child_process');
const {interruptedExecution}=require('../tools/converge');
assert.equal(typeof interruptedExecution,'function','signal interruption classifier missing');
if(process.platform!=='win32'){
 const killed=cp.spawnSync(process.execPath,['-e','process.kill(process.pid,"SIGTERM")']);
 assert.equal(killed.signal,'SIGTERM');
 assert.equal(interruptedExecution(killed),'EXECUTION_INTERRUPTED');
 const crashed=cp.spawnSync(process.execPath,['-e','process.kill(process.pid,"SIGSEGV")']);
 assert.equal(interruptedExecution(crashed),'EXECUTION_SIGNAL');
}
assert.equal(interruptedExecution({status:2,signal:null}),null,'CFG failure without signal must still learn');
assert.equal(interruptedExecution({status:0,signal:null}),null);
assert.equal(interruptedExecution({status:null,signal:'SIGINT'}),'EXECUTION_INTERRUPTED');
console.log('convergence-interruption-regression: OK');
