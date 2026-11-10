// REV174: PLB uses full-stack addressing, then restores page 1; behavioral oracle: cpu-generated-differential-v043618.
'use strict';
const fs=require('fs');const assert=require('assert');
const s=fs.readFileSync(require('path').join(__dirname,'..','forja65-core.js'),'utf8');
for(const token of [
  'db=pop8Value(hw,true);finishFullStackInstruction();nz(db,8)',
  'if(afterHigh==highPort)vmadd',
  'case 0x2139:',
  'case 0x213A:',
  'latchHvCounters()',
  'FORJA65_WRAM_WATCH_ADDRS',
])assert(s.includes(token),'generator lost CPU/PPU invariant: '+token);
console.log('REV172 generator retained CPU/PPU timing and WRAM instrumentation');
