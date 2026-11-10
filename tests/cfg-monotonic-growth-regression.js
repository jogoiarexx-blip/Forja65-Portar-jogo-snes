'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core'),P=require('../tools/project-io');
const rom=C.loadRom(C.makeSyntheticRom()),hash=C.romFingerprint(rom);
const original=C.analyze(rom,100),cache=P.makeCfgCache(original,hash);
const first=cache.functions[0],head=first.instructions[0];
const fresh=JSON.parse(JSON.stringify(original));
const grown=JSON.parse(JSON.stringify(first));
const alternatives=[false,true].map(carry=>C.decodeOne(rom,head.pc,{...head.stateIn,carry}));
grown.instructions=[...first.instructions.slice(1),...alternatives];
assert(grown.instructions.length>first.instructions.length);
assert(!grown.instructions.some(i=>i.stateKey===head.stateKey));
fresh.functions=[grown];
const result=P.mergeCfgCoverage(fresh,cache,hash,1000).a;
const retained=new Set(result.functions.flatMap(f=>f.instructions.map(i=>i.stateKey)));
for(const i of first.instructions)assert(retained.has(i.stateKey),'lost cached state '+i.stateKey);
for(const i of grown.instructions)assert(retained.has(i.stateKey),'lost newly discovered state '+i.stateKey);
// A shorter discovery can also add a new state; both frontiers must survive.
const shorter=JSON.parse(JSON.stringify(fresh));
shorter.functions[0].instructions=alternatives;
const shorterResult=P.mergeCfgCoverage(shorter,cache,hash,1000).a;
const shorterKeys=new Set(shorterResult.functions.flatMap(f=>f.instructions.map(i=>i.stateKey)));
for(const i of [...first.instructions,...alternatives])assert(shorterKeys.has(i.stateKey));
// Refusing a full cache must leave the caller's cached data untouched.
const before=JSON.stringify(cache);
assert.throws(()=>P.mergeCfgCoverage(fresh,cache,hash,first.instructions.length),/ceiling/);
assert.equal(JSON.stringify(cache),before);
console.log('CFG_MONOTONIC_GROWTH_PASS');
