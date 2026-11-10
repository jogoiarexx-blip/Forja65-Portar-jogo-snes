'use strict';
// Exercise the existing ABI probes with iterative generated calls enabled.
const C=require('../forja65-core');
const generate=C.generateProject;
C.generateProject=function(...args){const files=generate(...args);files['src/runtime.hpp']='#define FORJA65_STACKLESS_CALLS 1\n'+files['src/runtime.hpp'];return files;};
for(const name of ['pea-stack-bootstrap-v0317-regression.js','stack-return-lifetime-v0393-regression.js','stack-position-guard-v0393-regression.js','redirected-call-continuation-v0393-regression.js','hook-overlap-framework-regression.js'])require('./'+name);
console.log('STACKLESS_CALL_ABI_PASS');
