'use strict';
const assert=require('node:assert/strict'),F=require('../forja65-core');
assert.deepEqual(F.parseSpcMissProfile(' pc=0x0123 opcode=0xE8 count=7 \r\npc=0xabcd opcode=0x00\n'),[{pc:0x123,opcode:0xe8,count:7},{pc:0xabcd,opcode:0,count:1}]);
for(const text of ['pc=0x1234 opcode=0x1FF count=7','pc=0x10000 opcode=0x12 count=7','# pc=0x1234 opcode=0x12 count=7','pc=0x1234 opcode=0x12 count=-7','pc=0x1234 opcode=0x12 count=7junk','pc=0x1234 opcode=0x12 count=9007199254740993'])assert.deepEqual(F.parseSpcMissProfile(text),[],text);
const ram=new Uint8Array(65536);ram[0x200]=0xef;ram[0x1234]=0x1f;
const cap=F.loadSpcCapture(ram,'entry_candidate=0x200'),a=F.spcAnalyzeMulti([cap],{missProfiles:['pc=0x1234 opcode=0x1FF count=7']});
assert.equal(a.learnedRoots,0);assert(!a.instructions.some(x=>x.pc===0x1234));
console.log('SPC_MISS_PROFILE_VALIDATION_REV145_PASS valid-records malformed-values no-false-CFG-root');
