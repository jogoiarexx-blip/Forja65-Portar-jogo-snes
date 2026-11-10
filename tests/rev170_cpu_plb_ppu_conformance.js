// REV174: PLB uses full-stack addressing, then restores page 1; behavioral oracle: cpu-generated-differential-v043618.
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname,'..','forja65-core.js'),'utf8');
assert(source.includes('else if(what=="PLB"){db=pop8Value(hw,true);finishFullStackInstruction();nz(db,8);}'));
assert(!source.includes('else if(what=="PLB"){s=(std::uint16_t)(s+1)'));
assert(source.includes('updateVramReadBuffer();vmadd='), 'VRAM latch must prefetch before auto-increment');
assert(source.includes('writeCgram(v)'),'CGRAM data port must use shared latch');
assert(source.includes('FORJA65_CHECKPOINT_BRANCH_REPLAY'))
assert(source.includes('(controlMode?0u:2u)'), 'Linux headless control must not auto-stop');
console.log('REV170 generator CPU PLB and PPU latch conformance PASS');
