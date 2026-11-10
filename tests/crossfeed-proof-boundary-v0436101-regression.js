'use strict';
const assert=require('node:assert/strict'),{directJsrProof}=require('../tools/observed-direct-jsr-proof');
// CPU fetch wraps within PB. Adjacent file bytes across a bank boundary
// cannot authenticate this instruction through the contiguous-byte proof API.
for(const low of [0xfffe,0xffff]){
 const rom={data:Uint8Array.from([0x20,0x44,0xd5,0xea])};
 assert.equal(directJsrProof(rom,0xb80000|low,0xb8d544,()=>0),null,'must not authenticate operands from the next file bank');
}
const rom={data:Uint8Array.from([0x20,0x44,0xd5])};assert(directJsrProof(rom,0xb8fffd,0xb8d544,()=>0));
console.log('CROSSFEED_JSR_BOUNDARY_PROOF_PASS bank_wrap_unproved=rejected last_contiguous=accepted');
