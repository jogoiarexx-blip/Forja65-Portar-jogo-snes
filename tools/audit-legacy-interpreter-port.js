#!/usr/bin/env node
// REV135/Bust crossfeed: auditoria read-only de compatibilidade para ports antigos.
// Nao interpreta um numero de frames como sucesso sem evidencias no QA do jogo.
'use strict';
const fs = require('fs'), path = require('path');
const port = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('Uso: node tools/audit-legacy-interpreter-port.js <pasta-port>'); process.exit(2); }
const read = rel => fs.readFileSync(path.join(port, rel), 'utf8');
const rt=read('src/runtime.hpp'), dsp=read('src/dispatch.cpp'), cm=read('CMakeLists.txt'), main=read('src/main.cpp');
const start=rt.indexOf('struct CpuState {'),end=rt.indexOf('struct PpuState {',start);
const state=start>=0&&end>start?rt.slice(start,end):'';
const count=(text,re)=>(text.match(re)||[]).length;
const checks={
  single_stack_finish:count(state,/void finishFullStackInstruction\s*\(/g)===1,
  stack_pop_api:state.includes('void dropStack('),
  interpreter_present:fs.existsSync(path.join(port,'src/forja_cpu_interpreter.cpp')),
  dispatcher_fallback:dsp.includes('forja65_interpreter_enabled()')&&dsp.includes('forja65_interpret('),
  cmake_links_interpreter:cm.includes('src/forja_cpu_interpreter.cpp'),
  interpreter_report_on_exit:main.includes('forja65_interpreter_report('),
  remote_debug_control:rt.includes('FORJA65_CONTROL'),
  large_stack_helper:fs.existsSync(path.join(port,'src/forja_stack.cpp')),
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({schema:'forja65-interpreter-legacy-audit/1',port,ok,checks},null,2));
process.exit(ok?0:1);
