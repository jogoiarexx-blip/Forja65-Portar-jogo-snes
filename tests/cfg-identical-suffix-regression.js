'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core'),P=require('../tools/project-io');
const rom=C.loadRom(C.makeSyntheticRom()),hash=C.romFingerprint(rom),a=C.analyze(rom,100),cache=P.makeCfgCache(a,hash);
const base=cache.functions[0],fresh=JSON.parse(JSON.stringify(a));
const suffix=JSON.parse(JSON.stringify(base));suffix.start=base.instructions[1].pc;suffix.functionKey='suffix-fixture';suffix.instructions=suffix.instructions.slice(1);
// One genuinely new state at the suffix entry plus an otherwise identical tail.
const newInstruction=JSON.parse(JSON.stringify(suffix.instructions[0]));newInstruction.stateIn.carry=true;newInstruction.stateKey+='-new';suffix.instructions.unshift(newInstruction);
fresh.functions=[suffix];
const count=base.instructions.length;
const merged=P.mergeCfgCoverage(fresh,cache,hash,count+1).a;
assert.equal(merged.instructionVariants,count+1);
assert.deepEqual(merged.functions.find(f=>f.functionKey===base.functionKey),base);
assert.equal(merged.functions.find(f=>f.functionKey==='suffix-fixture').instructions.length,1);
assert.equal(merged.cfgCacheIdenticalInstructionsReused,suffix.instructions.length-1);
// A changed semantic field must never be suppressed as a duplicate.
const changed=JSON.parse(JSON.stringify(a));changed.functions=[JSON.parse(JSON.stringify(suffix))];changed.functions[0].instructions[1].operand=0x42;
assert.throws(()=>P.mergeCfgCoverage(changed,cache,hash,count+1),/ceiling/);
console.log('CFG_IDENTICAL_SUFFIX_PASS');
// Already-retained identical records are charged once, while both routines stay.
const duplicateCache=JSON.parse(JSON.stringify(cache));const duplicate=JSON.parse(JSON.stringify(base));duplicate.functionKey+='-copy';duplicateCache.functions.push(duplicate);
const empty=JSON.parse(JSON.stringify(a));empty.functions=[];
const compact=P.mergeCfgCoverage(empty,duplicateCache,hash,count).a;
assert.equal(compact.functions.length,2);
assert.equal(compact.cfgCacheUniqueInstructionVariants,count);
assert.equal(compact.instructionVariants,2*count);
