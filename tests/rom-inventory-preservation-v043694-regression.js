'use strict';
// Historical .94 preservation proof stays pinned to its archived core.
// Active .95 decoder/emitter compatibility is tested in cfg-global-preservation-v043695.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),C=require('../crossfeed-historico/v043694-rie-baseline/forja65-core'),Old=require('../crossfeed-historico/v043693-rie-baseline/forja65-core'),IO=require('../tools/project-io');
// REV202: decodificador de CFG mudou na .118; a linhagem auditada vale ate a .117 e o ativo rejeita caches anteriores.
assert(IO.isAuditedCacheVersion(Old.VERSION,'0.4.36.117-legacy-port-archaeology'),'previous .93 ports retained audited CFG cache support up to .117');assert(!IO.isAuditedCacheVersion(Old.VERSION));
const prior=fs.readFileSync(require.resolve('../crossfeed-historico/v043693-rie-baseline/forja65-core'),'utf8'),active=fs.readFileSync(require.resolve('../crossfeed-historico/v043694-rie-baseline/forja65-core'),'utf8');
function engine(source){const start=source.indexOf('function hex('),end=source.indexOf('function cppHex(');return source.slice(start,end);}
const before=engine(prior);let after=engine(active);
after=after.replace(/\n  if\(opts\.romInventory!==false\)a\.romInventory=inventoryRomInternal\(rom,a,\{cache:opts\.inventoryCache,dataRegions:knowledge\?knowledge\.dataRegions:\[\]\},romHash\);/,'');
after=after.replace(/\/\/ Stage 1 RIE observes the existing CFG; it never changes decode queues\.\nfunction inventoryRom\([\s\S]*?\nfunction directJumpTarget\(i\)/,'function directJumpTarget(i)');
assert.equal(after,before,'mapper, decoder, CPU states, CFG and heuristics must be byte-identical after removing the inventory-only wrapper');
assert.equal(crypto.createHash('sha256').update(before).digest('hex'),'bdcea47b3db8e2b8970fe02c2704e56408e27dcb9faf120c31e3aab8763277a1');
for(const code of [[0x18,0xfb,0xc2,0x30,0xa9,0x34,0x12,0xdb],[0x22,0x00,0x81,0x00,0xdb],[0x20,0x00,0x81,0xdb],[0x38,0xfb,0xe2,0x30,0xdb]]){
 const bytes=C.makeSyntheticRom();bytes.set(code);bytes.set([0xa9,0x17,0x6b],0x100);
 const a=C.analyze(C.loadRom(bytes),256),b=Old.analyze(Old.loadRom(bytes),256);assert.deepEqual(a.functions,b.functions);assert.deepEqual(a.issues,b.issues);
 const hash=C.romFingerprint(C.loadRom(bytes)),cache={...IO.makeCfgCache(b,hash),version:Old.VERSION};assert.throws(()=>IO.mergeCfgCoverage(a,cache,hash),/cache incompatible/);
 const now=C.generateProject(C.loadRom(bytes),a),then=Old.generateProject(Old.loadRom(bytes),b);
 for(const name of Object.keys(now).filter(n=>n.startsWith('src/')))assert.deepEqual(now[name],then[name],'C++ output changed: '+name);
}
console.log('ROM_INVENTORY_PRESERVATION_V043694_PASS');
