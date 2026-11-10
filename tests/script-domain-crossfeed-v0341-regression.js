'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');

function fixture(scriptDomain){
  let d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);
  d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0x0000);
  d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x000A);
  d[0x0010]=0x60;d[0x0014]=0x60;d[0x0018]=0x60;
  const rom=C.loadRom(d,'script-domain.sfc'),hash=C.romFingerprint(rom);
  const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture'}],dispatch:[{
    site:0x008007,targets:[0x008010,0x008014,0x008018],source:'fixture-script-audit',
    resolution:{kind:'inline-structural-table',entries:3,script_domain:scriptDomain}
  }],limits:[]};
  return {rom,pack};
}

let {rom,pack}=fixture({kind:'bytecode-script-domain-audit',complete:false,index_bounds_proven:false,closed_entries:90,invalid_entries:10,observed_ids_in_closed_entries:[0,1,2],table_entries:3});
let r=C.focusAnalyze(rom,[0x008000],pack,{maxPerTarget:128}).results[0];
let site=r.indirect_sites.find(x=>x.pc===0x008007);
assert(site,'partial script-domain site missing');
assert.equal(site.resolution.script_domain_complete,false);
assert.equal(site.resolution.script_domain_closed_entries,90);
assert.equal(site.resolution.script_domain_invalid_entries,10);
assert.equal(site.resolution.index_bounds_proven,false);
assert(r.issues.some(x=>x.kind==='CFG-SCRIPT-DOMAIN-PARTIAL'),'partial script-domain evidence was not surfaced');
assert(r.issues.some(x=>x.kind==='CFG-INDEX-DOMAIN-UNPROVEN'),'partial script evidence incorrectly closed local mask domain');

({rom,pack}=fixture({kind:'bytecode-script-domain-audit',complete:true,index_bounds_proven:true,closed_entries:100,invalid_entries:0,observed_ids_in_closed_entries:[0,1,2],table_entries:3}));
r=C.focusAnalyze(rom,[0x008000],pack,{maxPerTarget:128}).results[0];
site=r.indirect_sites.find(x=>x.pc===0x008007);
assert.equal(site.resolution.script_domain_complete,true);
assert.equal(site.resolution.index_bounds_proven,true);
assert.equal(site.resolution.index_domain_fits_table,true);
assert.equal(site.resolution.index_domain.source,'external-bytecode-script-domain-proof');
assert.deepEqual(site.resolution.index_domain.observed_ids,[0,1,2]);
assert(!r.issues.some(x=>x.kind==='CFG-SCRIPT-DOMAIN-PARTIAL'));
assert(!r.issues.some(x=>x.kind==='CFG-INDEX-DOMAIN-UNPROVEN'));

const normalized=C.normalizeKnowledgePack(pack,C.romFingerprint(rom));
assert.equal(normalized.dispatch[0].resolution.script_domain.complete,true);
console.log('script-domain-crossfeed-v0341-regression: OK');
