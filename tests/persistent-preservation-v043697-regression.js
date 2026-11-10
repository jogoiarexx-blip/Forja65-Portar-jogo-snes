'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),C=require('../forja65-core'),IO=require('../tools/project-io'),M=require('../tools/analysis-memory');
const base=path.join(__dirname,'../crossfeed-historico/v043696-rie-baseline'),Old=require(path.join(base,'forja65-core'));
const current=fs.readFileSync(require.resolve('../crossfeed-historico/v043697-rie-baseline/forja65-core'),'utf8'),old=fs.readFileSync(path.join(base,'forja65-core.js'),'utf8');
for(const [start,end]of [['function hex(','function cppHex('],['function cppHex(','function reportText('],['function generateVariantBody(','function generateFunction(']]){const part=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));assert.equal(part(current),part(old),'existing analysis/runtime/emitter altered');}
// REV202: decodificador de CFG mudou na .118; a linhagem auditada vale ate a .117 e o ativo rejeita caches anteriores.
assert(IO.isAuditedCacheVersion(Old.VERSION,'0.4.36.117-legacy-port-archaeology'));assert(!IO.isAuditedCacheVersion(Old.VERSION));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-persist-preserve-'));
try {
 for(const [n,code]of [[0,[0x18,0xfb,0xc2,0x30,0xa9,0x34,0x12,0xdb]],[1,[0x20,0,0x81,0xdb]],[2,[0x22,0,0x81,1,0xdb]],[3,[0xa2,4,0x7c,0,0x90]],[4,[0x08,0xc2,0x30,0x28,0xa9,0x42,0xdb]]]){
  const bytes=C.makeSyntheticRom();bytes.set(code);bytes.set([0xe2,0x30,0x6b],0x100);bytes.set([0,0x82],0x1004);bytes[0x200]=0xdb;const rom=C.loadRom(bytes),a=C.analyze(rom,64),b=Old.analyze(rom,64);assert.deepEqual(a.functions,b.functions);assert.deepEqual(a.issues,b.issues);
  const memory=M.createAnalysisMemory(path.join(dir,String(n)),{identity:{rom:C.romFingerprint(rom),source:'test'}}),request={max:64};memory.run(request,()=>a);memory.commit();const warm=memory.run(request,()=>assert.fail('exact hit expected'));assert.deepEqual(warm,a,'complete analysis serialization is lossless');const files=C.generateProject(rom,a),cached=C.generateProject(rom,warm);for(const name of Object.keys(files).filter(x=>x.startsWith('src/')))assert.equal(cached[name],files[name],name);
 }
 const modeBytes=C.makeSyntheticRom();modeBytes.set([0xdb]);modeBytes.set([0xa9,0x34,0x12,0xdb],0x100);const modeRom=C.loadRom(modeBytes);
 for(const state of [{emulation:true,m8:true,x8:true,carry:null},{emulation:false,m8:false,x8:false,carry:false},{emulation:false,m8:true,x8:false,carry:true},{emulation:false,m8:false,x8:true,carry:null},{emulation:false,m8:true,x8:true,carry:false}]){
  const options={discoverySeeds:[{start:0x018100,state,entryName:'MODE-PERSISTENCE'}]},request={max:64,options},memory=M.createAnalysisMemory(path.join(dir,'modes'),{identity:{rom:C.romFingerprint(modeRom),source:'test'}});const a=memory.run(request,()=>C.analyze(modeRom,64,[],options));memory.commit();const b=memory.run(request,()=>assert.fail('mode snapshot expected'));assert.deepEqual(a,b);assert(b.functions.some(f=>f.start===0x018100&&Object.keys(state).every(k=>f.entryState[k]===state[k])));
 }
 const fixture={version:C.VERSION,functions:[{start:0x8000,instructions:[{pc:0x8000}]}],romInventory:{metrics:{inventoriedBytes:32768},banks:[],mapping:{}}};let record=null;for(let n=0;n<40;n++)record=M.knowledgeReport(fixture,null,record,{romSha256:'a',source:'b'},{});assert.equal(record.history.length,32);assert.equal(record.history.at(-1).revision,40);assert.equal(M.knowledgeReport(fixture,null,record,{romSha256:'different'},{}).history.length,1);
 console.log('PERSISTENT_PRESERVATION_5_PROGRAMS_MAPS_NATIVE_OUTPUT_HISTORY_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
