'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom());
const generated=F.generateProject(rom,F.analyze(rom,64));
const h=generated['src/runtime.hpp'];
assert(h&&h.includes('#include <map>'));
assert(h.includes('std::map<std::uint32_t,std::uint32_t> spcAotMissPairs'));
assert(h.includes('spcAotMissPairs.try_emplace(key,0u)'));
assert(h.includes('for(const auto&kv:spcAotMissPairs)'));
assert(!h.includes('spcAotMissOpcode[pc]'),'last-opcode-only counter must not survive');
// Existing profiles allow two opcodes at the same PC; both must become guarded native cases.
const capture=new Uint8Array(65536);capture.fill(0xff);
capture.set([0xe8,1,0x6f],0x200);
const other=new Uint8Array(capture);other[0x200]=0xbc;
const result=F.spcAnalyzeMulti([{data:capture,entry:0x200,entries:[]},{data:other,entry:0x200,entries:[]}],
 {max:64,missProfiles:['pc=0x0200 opcode=0xE8 count=2\npc=0x0200 opcode=0xBC count=1\n']});
assert.equal(result.multiOpcodePcs,1);
const cpp=F.spcCppMulti(result);
assert(cpp.includes('case 0xE8u: return forja65SpcExecute<0xE8u>(apu);'));
assert(cpp.includes('case 0xBCu: return forja65SpcExecute<0xBCu>(apu);'));
console.log('SPC_AOT_PAIR_PROFILE_R16_PASS distinct_opcodes=2');
