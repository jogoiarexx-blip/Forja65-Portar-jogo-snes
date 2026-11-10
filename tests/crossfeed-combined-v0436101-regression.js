'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const C=require('../forja65-core'),IO=require('../tools/project-io'),Old=require('../crossfeed-historico/v043698-rie-preserved/forja65-core');
const root=path.resolve(__dirname,'..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
// Exact RIE modules from .98: merge guards, witness validation and persistence remain.
assert.equal(sha(fs.readFileSync(path.join(root,'analysis/cfg-coverage.js'))),sha(fs.readFileSync(path.join(root,'crossfeed-historico/v043698-rie-preserved/analysis/cfg-coverage.js'))));
// REV168 only permits one audited change to legacy RIE: Cx4 LoROM CPU vectors.
const legacyGuard="if(rom.header.coprocessor&&!['NONE','DSP1'].includes(rom.header.coprocessor))return {roots,rejected:[{reason:'unsupported-coprocessor-base-map-only'}]};", currentGuard="// The Cx4 on LoROM MMX2/MMX3 occupies bank 00-3F/80-BF:$6000-$7FFF,\n // which does not overlap the CPU vectors at $FFE4-$FFF8 or their $8000+\n // targets. Vector-root discovery decodes *65C816* code only; it NEVER\n // claims to disassemble the Cx4 DSP. Other unsupported chips remain gated.\n if(rom.header.coprocessor&&!['NONE','DSP1'].includes(rom.header.coprocessor) &&\n    !(rom.header.coprocessor==='CX4'&&rom.header.mapping==='LoROM'))\n   return {roots,rejected:[{reason:'unsupported-coprocessor-base-map-only'}]};";
for(const rel of ['analysis/cfg-global.js']){
 const current=fs.readFileSync(path.join(root,rel),'utf8');
 const oldText=fs.readFileSync(path.join(root,'crossfeed-historico/v043698-rie-preserved',rel),'utf8');
 assert.equal(current.split(currentGuard).length,2);
 assert.equal(sha(current.replace(currentGuard,legacyGuard)),sha(oldText),'other RIE decode/flow semantics must remain unchanged');
}
// REV202: o decodificador ativo (.118) mudou de proposito (tabelas inline apos JSL/JSR) e por isso rejeita
// caches antigos. A auditoria historica de texto do decodificador passa a usar a .117 arquivada.
const src=fs.readFileSync(path.join(root,'forja65-core.js'),'utf8'),rev201=fs.readFileSync(path.join(root,'crossfeed-historico/v0436117-rev201/forja65-core.js'),'utf8'),prior=fs.readFileSync(path.join(root,'crossfeed-historico/v043698-rie-preserved/forja65-core.js'),'utf8');
for(const [start,end]of [['function decodeOne(','function decodeLinear('],['function decodeCfgFunction(','function runtimeHintKey(']]){const part=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));assert.equal(part(rev201),part(prior),'existing 65816 decoder/CFG changed');}
for(const code of [[0xea,0xdb],[0x18,0xfb,0xc2,0x30,0xa9,0x34,0x12,0xdb],[0x08,0xc2,0x30,0x28,0xdb],[0x22,0,0x81,1,0xdb],[0xa2,4,0x7c,0,0x90]]){
 const bytes=C.makeSyntheticRom();bytes.set(code);bytes.set([0x6b],0x100);bytes.set([0,0x82],0x1004);bytes[0x200]=0xdb;
 const a=C.analyze(C.loadRom(bytes),128),old=Old.analyze(Old.loadRom(bytes),128);assert.deepEqual(a.functions,old.functions);assert.deepEqual(a.issues,old.issues);
}
assert(IO.isAuditedCacheVersion(Old.VERSION,'0.4.36.117-legacy-port-archaeology'));assert(IO.isAuditedCacheVersion('0.4.36.99-rie-observed-jsr-verified','0.4.36.117-legacy-port-archaeology'));assert(!IO.isAuditedCacheVersion(Old.VERSION));
assert(!IO.isAuditedCacheVersion('0.4.36.86-pending-regressions-fixed'));assert(!IO.isAuditedCacheVersion('FAKE_VERSION'));
assert(!IO.isAuditedCacheVersion('0.4.36.95-rie-cfg-global','0.4.36.99-rie-observed-jsr-verified'),'upstream indexed cache branch must not gain an unaudited edge');
const bytes=C.makeSyntheticRom(),rom=C.loadRom(bytes),files=C.generateProject(rom,C.analyze(rom,128));
for(const n of ['tools/native_oracle_build.py','docs/NATIVE-ORACLE-BUILD.txt','src/forja_checkpoint.hpp','analysis/rom-inventory.json','analysis/cfg-global.json','analysis/indirect-targets.json'])assert(files[n]);
assert.equal(files['tools/native_oracle_build.py'],fs.readFileSync(path.join(root,'tools/native_oracle_build.py'),'utf8'));
const context={console,Uint8Array,TextEncoder,TextDecoder};vm.runInNewContext(src,context);const B=context.Forja65Core,brom=B.loadRom(bytes),bf=B.generateProject(brom,B.analyze(brom,128));
assert.equal(bf['src/runtime.hpp'],files['src/runtime.hpp']);assert.equal(bf['tools/native_oracle_build.py'],files['tools/native_oracle_build.py']);
console.log('CROSSFEED_COMBINED_PASS decoder_cfg=preserved five_programs=node browser_templates=equal cache_branches=bounded');
