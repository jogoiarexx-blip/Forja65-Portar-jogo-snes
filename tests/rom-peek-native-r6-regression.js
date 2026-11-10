// Verify REV174 generator emits native-ROM-safe metadata reads into future ports.
const assert=require('assert');
const Core=require('../forja65-core.js');
const rom=Core.loadRom(Core.makeSyntheticRom(),'r6-synthetic.sfc');
const analysis=Core.analyze(rom,4096);
const project=Core.generateProject(rom,analysis);
const runtime=String(project['src/runtime.hpp']);
assert.ok(runtime.includes('bool peekRomOffset(std::size_t off,std::uint8_t&out)const'));
assert.ok(runtime.includes('if(peekRomOffset(romOffset(a),v))return v;'));
assert.ok(runtime.includes('return peekRomOffset(off,v)?int(v):-1;'));
assert.ok(!runtime.includes('return off==std::size_t(-1)||off>=cart.size()?-1:cart[off]'));
let interp=String(project['src/forja_cpu_interpreter.cpp']||'');
assert.ok(interp.includes('if(hw.peekRomOffset(ro,out[k]))continue;'),'Interpreter must decode from native ROM data pack');
console.log('ROM_PEEK_NATIVE_R6_GENERATOR_PASS');
