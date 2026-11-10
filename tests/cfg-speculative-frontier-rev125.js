#!/usr/bin/env node
'use strict';
// REV125: return-adjacent discovery may suggest one new entry, but must not
// recursively reinterpret long stretches of data as code. The behavior is
// deliberately independent of any commercial ROM asset.
const assert=require('node:assert/strict');
const Forja=require('../forja65-core.js');
let assertions=0;
const check=(p,m)=>{assert.ok(p,m);assertions++;};
const data=new Uint8Array(0x80000);data.fill(0xEA);
data.set(Forja.makeSyntheticRom().slice(0,0x8000));
// 128 adjacent RTS instructions: the old algorithm spent all 64 candidate
// slots chasing conjectures. Only RESET and its first speculative neighbour
// should be reachable through linear-sweep alone.
for(let i=0;i<128;i++)data[i]=0x60;
const rom=Forja.loadRom(data,'rev125-synthetic.sfc');
const options={globalCfg:false,romInventory:false,summaryRounds:0,bundledKnowledge:false};
const result=Forja.analyze(rom,512,[],options);
check(result.returnAdjacentSeeds===1,'do not recursively seed guessed routines');
check(result.decoded===2,'only two RTS opcodes should be decoded');
check(result.cfgSpeculativeInstructionVariants===1,'one speculative decoded instruction');
check(result.cfgSuppressedAdjacentCascade===1,'one speculative RTS cascade suppressed');
check(result.cfgDiscoverySources.RESET===1,'RESET source accounted for');
check(result.cfgDiscoverySources['SPECULATIVE:RETURN-ADJACENT']===1,'guessed source labeled');
check(result.functions[0].entryName==='RESET'&&!result.functions[0].speculativeSeed,'RESET must retain trusted origin');
check(result.functions[1].speculativeSeed===true,'return-adjacent must be marked speculative');
const report=Forja.reportText(result);
check(report.includes('Cascatas de RTS/RTL especulativas bloqueadas: 1'),'visible provenance in report');
// A real observed runtime hint is still admitted, even when the first pass
// must stay within a small budget. No automatic promotion of guessed peers.
data[0x90]=0x60;
const observed=Forja.loadRom(data,'rev125-synthetic.sfc');
const hint={from:0x008000,target:0x008090,state:{emulation:true,m8:true,x8:true,carry:null},kind:'FLOW',rom:Forja.romFingerprint(observed)};
const withHint=Forja.analyze(observed,512,[hint],options);
check(withHint.functions.some(f=>f.start===0x8090&&!f.speculativeSeed),'real observed target preserved');
check(withHint.runtimeHintsRejected===0,'ROM bound observation accepted');
console.log('PASS REV125 CFG speculative guard ('+assertions+' assertions)');
