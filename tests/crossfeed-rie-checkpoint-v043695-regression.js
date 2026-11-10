'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const F=require('../forja65-core');
const base=fs.readFileSync(path.join(__dirname,'../crossfeed-historico/v043698-rie-preserved/forja65-core.js'),'utf8');
// REV202: o decodificador ativo (.118) mudou de proposito (tabelas inline apos JSL/JSR) e por isso rejeita
// caches antigos. A auditoria historica de texto do decodificador passa a usar a .117 arquivada.
const now=fs.readFileSync(path.join(__dirname,'../crossfeed-historico/v0436117-rev201/forja65-core.js'),'utf8');
for(const [start,end] of [['function decodeOne(','function decodeLinear('],['function decodeCfgFunction(','function runtimeHintKey(']]){
 const part=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));
 assert(now.indexOf(start)>=0&&base.indexOf(start)>=0,'missing CPU analyzer '+start);
 assert.equal(part(now),part(base),'CPU analyzer mutated: '+start);
}
const rom=F.loadRom(F.makeSyntheticRom());
const analysis=F.analyze(rom,256);
assert(analysis.rieGlobal,'RIE global removed');
const files=F.generateProject(rom,analysis);
for(const n of ['src/runtime.hpp','src/forja_checkpoint.hpp','src/dispatch.cpp','src/main.cpp','tools/near-crash-checkpoint.py','CHECKPOINT-CREATE-WINDOWS.cmd','CHECKPOINT-RESUME-WINDOWS.cmd','analysis/cfg-global.json','analysis/rom-inventory.json'])
 assert(files[n]&&files[n].length,'missing generated file '+n);
assert(files['src/runtime.hpp'].includes('armConstructedLongReturn('));
assert(files['src/runtime.hpp'].includes('checkpointYieldRequested'));
assert(files['src/main.cpp'].includes('FORJA65_CHECKPOINT_SAVED'));
assert(files['src/main.cpp'].includes('FORJA65_CHECKPOINT_LOADED'));
assert(files['src/dispatch.cpp'].includes('hw.armConstructedLongReturn(requested,cpu)'));
console.log('CROSSFEED_RIE_CHECKPOINT_V043695_PASS');
