#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {patchAotFrontier}=require('../forja65-core.js');
const before=`#include "generated.hpp"
bool forja65_interpreter_enabled(){return on&&forja65_interpreter_hooks.interpret!=nullptr;}
void sample(){else hw.unresolvedFlow(src,requested,cpu);else hw.unresolvedState(src,requested,cpu.e,cpu.m8,cpu.x8,cpu.c); else hw.unresolvedFlow(from,target,cpu);}`;
const files={'src/dispatch.cpp':before};patchAotFrontier(files);
const after=files['src/dispatch.cpp'];
assert(after.includes('return !forja65_aot_only()&&on&&'));
assert(after.includes('"missing_entry"'));
assert(after.includes('"missing_variant"'));
assert(after.includes('"flow_outside_cfg"'));
assert(after.includes('#include "forja_aot_frontier.hpp"'));
assert(files['src/forja_aot_frontier.hpp'].includes('FORJA65_CPU_AOT_ONLY'));
patchAotFrontier(files);assert.strictEqual(files['src/dispatch.cpp'],after);
const noInterpreter={'src/dispatch.cpp':'#include "generated.hpp"'};
patchAotFrontier(noInterpreter);assert(!noInterpreter['src/forja_aot_frontier.hpp']);
const L=require('../tools/learn-from-interpreter.js');
const parsed=L.parseLog('FORJA65_CPU_AOT_FRONTIER 1\n# reason=missing_variant carry=1\nBED07B M0X1 from=B6A102 count=1\n');
assert.strictEqual(parsed.length,1);
assert.strictEqual(parsed[0].target,0xBED07B);
assert.strictEqual(parsed[0].from,0xB6A102);
assert.strictEqual(parsed[0].m,0);
assert.strictEqual(parsed[0].x,1);
console.log('REV180_NATIVE_AOT_PATCH_PASS tests=13');
