#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core.js');
const L=require('../tools/learn-from-interpreter.js');
const data=new Uint8Array(32768);data.fill(0xea); // NOP-filled LoROM
const rom=C.loadRom(data,'audit-test.sfc');
const hash=C.romFingerprint(rom);
const good='FORJA65_CPU_INTERPRETER 1\nrom='+hash+'\nblocks=1\ninstructions=1\n# entrada estado(E/M/X) origem execucoes\n008000 M1X1 from=008005 count=1\n';
assert.equal(L.verifyLogRomIdentity(good,rom).source,'log');
assert.throws(()=>L.verifyLogRomIdentity(good.replace(hash,'ffffffffffffffff'),rom),/ROM mismatch/);
assert.throws(()=>L.verifyLogRomIdentity(good.replace('rom='+hash,'rom=nope'),rom),/malformed/);
assert.throws(()=>L.verifyLogRomIdentity(good+'rom='+hash+'\n',rom),/more than one/);
const legacy=good.replace('rom='+hash+'\n','');
assert.throws(()=>L.verifyLogRomIdentity(legacy,rom),/lacks ROM proof/);
const audit='FORJA65_NATIVE_DEPENDENCY_AUDIT 1\nrom='+hash+'\n';
assert.equal(L.verifyLogRomIdentity(legacy,rom,{auditText:audit}).source,'audit');
assert.throws(()=>L.verifyLogRomIdentity(legacy,rom,{auditText:audit.replace(hash,'bbbbbbbbbbbbbbbb')}),/ROM mismatch/);
assert.equal(L.verifyLogRomIdentity('008000 M1X1 from=008005 count=1\n',rom).source,'legacy-unverified');
console.log('PASS REV174 R9 interpreter ROM-audit identity (8 assertions)');
