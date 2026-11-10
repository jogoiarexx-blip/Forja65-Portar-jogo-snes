#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {directJsrProof}=require('../tools/observed-direct-jsr-proof.js');
const rom={data:new Uint8Array(0x100)};
rom.data.set([0x20,0x44,0xd5],0x30);
const map=(_rom,pc)=>pc===0xB8D52F?0x30:null;
const ok=directJsrProof(rom,0xB8D52F,0xB8D544,map);
assert.deepEqual([ok.source,ok.target,ok.opcode],['B8D52F','B8D544','20 44 D5']);
let rejected=0;
const reject=(rom,from,to,map)=>{assert.equal(directJsrProof(rom,from,to,map),null);rejected++;};
reject(rom,0xB8D52F,0xB8D545,map); // wrong operand
reject(rom,0xB8D52F,0xB9D544,map); // illegal JSR cross bank
reject(rom,0xB8D530,0xB8D544,map); // no source
reject(rom,0xB8D52F,-1,map);      // illegal destination
reject(rom,0xB8D52F,0xB8D544,()=>0xff); // truncated operand
const bad={data:rom.data.slice()};bad.data[0x30]=0x22;
reject(bad,0xB8D52F,0xB8D544,map); // JSL not JSR
const bad2={data:rom.data.slice()};bad2.data[0x32]=0xd4;
reject(bad2,0xB8D52F,0xB8D544,map); // swapped ROM bank/operand
console.log('OBSERVED_DIRECT_JSR_PROOF_V043699_PASS accepted=1 rejected='+rejected);
