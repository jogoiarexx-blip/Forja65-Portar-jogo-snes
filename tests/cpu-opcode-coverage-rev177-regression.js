// REV177: 65816 sparse ROM: size depends on E/M/X flags; never invent operands.
'use strict';
const assert = require('node:assert/strict');
const {buildCpuInterpreterSource} = require('../forja65-core.js');
const src=buildCpuInterpreterSource();
const hit=src.match(/kForja65InsnSize\[5\]\[256\]\s*=\s*\{([\s\S]*?)\n\s*\};/);
assert.ok(hit, 'opcode size table is emitted');
const rows=[...hit[1].matchAll(/\{([^}]+)\}/g)].map(m=>m[1].split(',').map(Number));
assert.equal(rows.length,5);
for(const row of rows){assert.equal(row.length,256);assert.ok(row.every(n=>n>=1&&n<=4));}
// Order: E1, M0X0, M0X1, M1X0, M1X1.
assert.deepEqual(rows.map(r=>r[0xA9]),[2,3,3,2,2], 'LDA #immediate depends on M');
assert.deepEqual(rows.map(r=>r[0xA2]),[2,3,2,3,2], 'LDX #immediate depends on X');
assert.deepEqual(rows.map(r=>r[0xEA]),[1,1,1,1,1], 'NOP has no operand');
assert.deepEqual(rows.map(r=>r[0xAF]),[4,4,4,4,4], 'LDA long uses 24-bit operand');
assert.ok(src.includes('if(!forja65_peek_code(hw,pc,b,1u))'),'first fetch opcode only');
assert.ok(src.includes('kForja65InsnSize[si][b[0]]'),'fetch exactly all required operand bytes');
assert.ok(src.includes('return false;\n    }\n    return true;'),'missing operand aborts instead of zero-fill');
console.log('PASS REV177 opcode sizes 5 x 256, sparse ROM fetch and E/M/X variants');
