// Historical .95 preservation pinned; active .96 has its own source/emitter audit.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),C=require('../crossfeed-historico/v043695-rie-baseline/forja65-core'),Old=require('../crossfeed-historico/v043694-rie-baseline/forja65-core'),IO=require('../tools/project-io');
// Loading an archived engine must not replace the current engine's bundled services.
assert(C.analyze(C.loadRom(C.makeSyntheticRom()),128).rieGlobal);
// REV202: o decodificador de CFG mudou (tabelas inline apos JSL/JSR); a linhagem auditada termina na .117.
assert(IO.isAuditedCacheVersion(Old.VERSION,'0.4.36.117-legacy-port-archaeology'));assert(!IO.isAuditedCacheVersion(Old.VERSION),'REV202 nao reaproveita cache anterior');
const modern=fs.readFileSync(require.resolve('../crossfeed-historico/v043695-rie-baseline/forja65-core'),'utf8'),old=fs.readFileSync(require.resolve('../crossfeed-historico/v043694-rie-baseline/forja65-core'),'utf8');
for(const [start,end]of [['function decodeOne(','function decodeLinear('],['function decodeCfgFunction(','function runtimeHintKey('],['function cppHex(','function reportText('],['function generateVariantBody(','function generateFunction(']]){
 const part=s=>{const a=s.indexOf(start),b=s.indexOf(end,a);assert(a>=0&&b>a);return s.slice(a,b);};assert.equal(part(modern),part(old),'CPU decoder/emitter/runtime changed: '+start);
}
for(const code of [[0x18,0xfb,0xc2,0x30,0xa9,0x34,0x12,0xdb],[0x22,0x00,0x81,0x00,0xdb],[0x20,0x00,0x81,0xdb],[0x38,0xfb,0xe2,0x30,0xdb]]){
 const bytes=C.makeSyntheticRom();bytes.set(code);bytes.set([0xa9,0x17,0x6b],0x100);const r=C.loadRom(bytes),a=C.analyze(r,256,[],{globalCfg:false}),b=Old.analyze(r,256);assert.deepEqual(a.functions,b.functions);assert.deepEqual(a.issues,b.issues);
 const now=C.generateProject(r,a),prior=Old.generateProject(r,b);for(const n of Object.keys(now).filter(n=>n.startsWith('src/')))assert.equal(now[n],prior[n],n);
 const cache={...IO.makeCfgCache(b,C.romFingerprint(r)),version:Old.VERSION};assert.throws(()=>IO.mergeCfgCoverage(a,cache,C.romFingerprint(r)),/cache incompatible/); // REV202: caches .95 nao sao mais aceitos
}
console.log('CFG_GLOBAL_PRESERVATION_V043695_PASS');
