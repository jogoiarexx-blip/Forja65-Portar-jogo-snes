#!/usr/bin/env node
'use strict';
// REV133: interpretador 65C816 de fallback.
//  1) projeto gerado traz src/forja_cpu_interpreter.cpp (1280 variantes) e o dispatcher ligado a ele,
//     mantendo o caminho antigo (unresolvedFlow/unresolvedState) quando FORJA65_CPU_INTERPRETER=0;
//  2) o interpretador passa nos 3.032 vetores SingleStepTests do fixture (estado, ordem do barramento, ciclos).
const assert=require('assert'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..');
const F=require(path.join(root,'forja65-core.js'));
const rom=F.loadRom(F.makeSyntheticRom(),'interp-test.sfc');
const files=F.generateProject(rom,F.analyze(rom,64));
const interp=files['src/forja_cpu_interpreter.cpp'];
assert(interp,'projeto gerado sem src/forja_cpu_interpreter.cpp');
assert.strictEqual((interp.match(/^static void forja65_i[0-4]_[0-9a-f]{2}\(/gm)||[]).length,1280,'esperadas 1280 variantes (5 estados x 256 opcodes)');
const d=files['src/dispatch.cpp'];
assert(d.includes('forja65_interpret(cpu,hw,requested,src,&forja65_has_compiled)'),'dispatcher sem fallback interpretado');
assert(d.includes('hw.unresolvedFlow(src,requested,cpu);')&&d.includes('forja65_record_aot_miss(src,requested,cpu,"missing_entry")'),'caminho legado de fluxo ausente ou sem auditoria REV180');
assert(d.includes('hw.unresolvedState(src,requested,cpu.e,cpu.m8,cpu.x8,cpu.c);')&&d.includes('forja65_record_aot_miss(src,requested,cpu,"missing_variant")'),'caminho legado de estado ausente ou sem auditoria REV180');
assert(files['CMakeLists.txt'].includes('src/forja_cpu_interpreter.cpp'),'CMake sem o interpretador');
assert(files['src/generated.hpp'].includes('void forja65_interpret('),'generated.hpp sem declaracao');
const off=F.generateProject(rom,F.analyze(rom,64),{cpuInterpreter:false});
assert(!off['src/forja_cpu_interpreter.cpp']&&!off['src/dispatch.cpp'].includes('forja65_interpret('),'opcao cpuInterpreter:false nao respeitada');
if(process.env.FORJA65_SKIP_NATIVE_TESTS){console.log('cpu-interpreter-v0436133: estrutura OK (compilacao pulada)');process.exit(0);}
const r=cp.spawnSync(process.execPath,[path.join(root,'tools','sst65816-interpreter-conformance.js'),path.join(root,'tests','fixtures','sst65816-rev132-fixture.json.gz')],{encoding:'utf8',maxBuffer:1<<26,timeout:1800000});
const m=/\{"cases":(\d+),"state_fail":(\d+),"bus_order_fail":(\d+),"cycle_fail":(\d+),"disputed":(\d+)/.exec(r.stdout||'');
assert(m,'saida do teste de conformidade ausente:\n'+(r.stdout||'')+(r.stderr||''));
assert.strictEqual(+m[1],3032,'quantidade de vetores');
assert.strictEqual(+m[2]+ +m[3]+ +m[4],0,'falhas no interpretador: '+m[0]);
assert(+m[5]<=4,'casos disputados acima do esperado');
console.log(`cpu-interpreter-v0436133: PASS (${m[1]} vetores SST, 0 falhas, ${m[5]} disputados)`);
