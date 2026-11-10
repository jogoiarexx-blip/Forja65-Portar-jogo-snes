'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
const {verify}=require('../tools/verify-generated-rom.js');
const rom=C.makeSyntheticRom(),r=C.loadRom(rom);
// A minimal CPU routine, with deterministic ROM opcode bytes.
const entry=0x808060,off=C.snesToRom(r,entry);
r.data[off]=0xEA; // NOP
r.data[off+1]=0xDB; // STP
const sample='void f(){\nL_808060:\n hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x8060u,cpu,0xEAu);\nL_808061:\n hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x8061u,cpu,0xDBu);\n}\n';
const fingerprint=C.romFingerprint(r);
const proof=verify(r.data,sample,'808060',fingerprint);
assert.strictEqual(proof.unique_rom_opcodes,2);
assert.strictEqual(proof.rom_opcode_mismatches,0);
assert.throws(()=>verify(r.data,sample,'808062',fingerprint),/Entry label/);
assert.throws(()=>verify(r.data,sample,'808060','0000000000000000'),/fingerprint/);
assert.throws(()=>verify(r.data,sample.replace('cpu,0xEAu','cpu,0x00u'),'808060',fingerprint),/opcode mismatches/);
const corrupted=r.data.slice();corrupted[off]=0x00;
assert.throws(()=>verify(corrupted,sample,'808060'),/opcode mismatches/);
console.log('generated-rom-provenance-v0396-regression: OK');
