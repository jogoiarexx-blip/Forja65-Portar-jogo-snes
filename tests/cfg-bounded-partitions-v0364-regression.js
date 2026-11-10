'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core');
const data=F.makeSyntheticRom();
// A synthetic reachable 250-opcode function. A conditional branch jumps
// across a generated partition boundary; no instruction is discarded.
data.fill(0xEA,0,250);
data.set([0xD0,0x35],145); // BNE $80CC (145+2+53=200), crossing the 160-variant boundary.
data[249]=0xDB; // STP
const rom=F.loadRom(data,'partition-smoke.sfc');
const analysis=F.analyze(rom,4096);
const generated=F.generateProject(rom,analysis);
const source=Object.entries(generated).filter(([p])=>/^src\/generated_\d+\.cpp$/.test(p)).map(([,s])=>s).join('\n');
const dispatcher=generated['src/dispatch.cpp'];
const parts=[...new Set([...source.matchAll(/void sub_008000_[A-Za-z0-9_]+_part\d+\(/g)].map(x=>x[0]))];
assert(parts.length>=2,`Expected split native function, got ${parts.length}`);
assert(source.includes('hw.requestDispatch(0x0080C8u,0x008091u); return;'), 'Cross-partition conditional branch must dispatch, not unresolvedFlow');
assert(source.includes('hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x80A1u,0x0080A0u); return;'), 'Cross-partition sequential fallthrough must dispatch');
assert(dispatcher.includes('0x0080C8u')&&dispatcher.includes('0x0080A0u'),'Every chunk needs dispatcher entries');
assert(!source.includes('hw.unresolvedFlow(0x008091u,0x0080C8u'),'Known targets may not produce unresolvedFlow');
console.log('CFG_BOUNDED_PARTITIONS_V0364_PASS',{parts:parts.length, decoded:analysis.decoded});
