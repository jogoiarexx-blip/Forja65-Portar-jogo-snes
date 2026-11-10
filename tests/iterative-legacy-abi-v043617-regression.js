'use strict';
// Compile the same emitter with the explicit legacy switch for ABI comparison.
const C=require('../forja65-core'),generate=C.generateProject;
C.generateProject=function(...args){const p=generate(...args);p['src/runtime.hpp']='#define FORJA65_STACKLESS_CALLS 0\n'+p['src/runtime.hpp'];return p;};
for(const n of ['native-hooks-framework-regression.js','redirected-call-continuation-v0393-regression.js'])require('./'+n);
console.log('ITERATIVE_LEGACY_ABI_V043617_PASS recursive_reference=0 hooks=guarded nonlocal=preserved');
