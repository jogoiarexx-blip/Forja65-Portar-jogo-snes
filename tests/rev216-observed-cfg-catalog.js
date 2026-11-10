'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core');
const pack=require('../profiles/super-bomberman-2/cfg-knowledge.json');
const proof=require('../profiles/super-bomberman-2/observed-cpu-entry-states-rev216.json');
const union=require('../reports/rev216/knowledge-union.json');
const signature=e=>[typeof e.address==='number'?e.address:parseInt(e.address,16),e.state.emulation,e.state.m8,e.state.x8,e.state.carry??null].join('|');
const hash='3ce797fd0241fce8',source='bomberman-v057-v059-observed-interpreter-rev216';
assert.equal(pack.rom.fnv1a64,hash);assert.deepEqual(proof.rom,pack.rom);
assert.deepEqual(C.bundledCfgKnowledge(hash),C.normalizeKnowledgePack(pack,hash));
assert.equal(C.bundledCfgKnowledge('ffffffffffffffff'),null);
assert.throws(()=>C.bundledCfgKnowledge(hash,{...pack,rom:{fnv1a64:'ffffffffffffffff'}}),/ROM fingerprint mismatch/);
const added=pack.entries.filter(e=>e.source===source),historical=pack.entries.filter(e=>e.source!==source);
assert.equal(historical.length,620);assert.equal(added.length,126);assert.equal(pack.entries.length,746);
assert.equal(new Set(pack.entries.map(signature)).size,746,'preserve each distinct carry/width variant');
assert.equal(proof.sources.length,9);let rows=0;const observed=new Set();
for(const s of proof.sources){
 assert.match(s.sha256,/^[a-f0-9]{64}$/);assert(s.rom_identity.length>0);
 for(const id of s.rom_identity)assert.match(id.sha256,/^[a-f0-9]{64}$/);
 assert.equal(s.rows,s.observations.length);rows+=s.rows;
 for(const row of s.observations){
  assert(Number.isSafeInteger(row.count)&&row.count>0);assert.equal(row.state.carry,null);
  assert(!row.state.emulation||(row.state.m8&&row.state.x8));observed.add(signature(row));
 }
}
assert.equal(rows,309);assert.equal(observed.size,126);
assert.deepEqual(new Set(added.map(signature)),observed,'only observed entry states may be added');
for(const e of added){assert.equal(e.state.carry,null);assert(e.evidence.some(x=>x.includes(hash)));}
assert.equal(union.before_entries,620);assert.equal(union.added_entries,126);assert.equal(union.after_entries,746);
assert(union.preserved_baseline_entries);assert(union.core_non_catalog_content_unchanged_by_union);
assert.equal(C.analyze(C.loadRom(C.makeSyntheticRom()),64,[],{globalCfg:false}).bundledCfgEntries,0);
console.log('REV216_OBSERVED_CFG_CATALOG_PASS reports=9 rows=309 observed=126 catalog=746');
