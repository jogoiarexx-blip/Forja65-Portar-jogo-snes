'use strict';
const assert=require('node:assert/strict'),F=require('../forja65-core');
const src=F.makeSyntheticRom();
// With only one decoded opcode, do not silently stop on an uncompiled fallthrough.
src.set([0xEA,0xEA,0xDB],0);
const rom=F.loadRom(src,'fallthrough.sfc');
const a=F.analyze(rom,1) // intentionally tiny instruction limit
const generated=F.generateProject(rom,a);
const cpp=Object.entries(generated).filter(([k])=>/^src\/generated_\d+\.cpp$/.test(k)).map(([,s])=>s).join('\n');
assert(cpp.includes('hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x8001u,0x008000u); return;'),'normal fallthrough must dynamically dispatch');
assert(generated['CMakeLists.txt'].includes('FORJA65_USE_PCH'),'PCH option missing from generated build');
console.log('CFG_FALLTHROUGH_V0363_PASS');
