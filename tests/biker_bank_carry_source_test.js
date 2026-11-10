// Minimal source invariant: the generated runtime must perform 24-bit addition.
// The behavioral C++ regression lives in the Biker Mice v0.4 package.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'forja65-core.js'), 'utf8');
const required = [
  'if(mode=="absx")return(((std::uint32_t)db<<16)+(q&0xFFFFu)+x)&0xFFFFFFu;',
  'if(mode=="absy")return(((std::uint32_t)db<<16)+(q&0xFFFFu)+y)&0xFFFFFFu;',
  'inline std::uint32_t CpuState::addressDpIndirectY(',
  'inline std::uint32_t CpuState::addressStackIndirectY(',
  'return(((std::uint32_t)db<<16)+base+y)&0xFFFFFFu;'
];
// REV143: com o custo de dado dos modos indiretos (REV138 reintegrado) a expressao vem dentro de forja65IndirectData(...).
const variants=e=>[e,e.replace(/^return\(/,'return forja65IndirectData(*this,hw,(').replace(/;$/,');')];
for (const expr of required) assert(variants(expr).some(v=>source.includes(v)), `missing CPU bank carry: ${expr}`);
console.log('FORJA65_BIKER_BANK_CARRY_TEMPLATE_PASS');
