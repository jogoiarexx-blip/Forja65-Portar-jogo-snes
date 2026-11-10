// REV184: generated checkpoint decoder must not wrap size_t on corrupt cursor.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const src=fs.readFileSync(path.join(__dirname,'..','forja65-core.js'),'utf8');
assert(src.includes('if(pos>data.size()||len>data.size()-pos)throw std::runtime_error("checkpoint truncated")'),
  'generated checkpoint header lacks cursor guard');
assert(src.includes('pending 65816 native return frames'),
  'generated checkpoint lost native-return rejection');
console.log('REV184_GENERATOR_CODEC_AND_NATIVE_GUARD_PASS');
