'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),C=require('../forja65-core');
const pack=require('../profiles/super-bomberman-2/cfg-knowledge.json');
assert.equal(typeof C.bundledCfgKnowledge,'function','Forja must retain the corrected handler catalog');
const hash=pack.rom.fnv1a64,k=C.bundledCfgKnowledge(hash);
assert.deepEqual(k,C.normalizeKnowledgePack(pack,hash),'bundled/browser catalog must match the readable JSON');
assert(k.entries.length>=606);assert(new Set(k.entries.map(x=>x.address)).size>=548);
for(const pc of ['CCA055','CCA070','CCA089','CCA0A2','CCA0BB','CCA0D4','CCA10B','CCA1A2','CCA203','CCA118','CCE4BE','CCE49E','CC4648']){
 assert(k.entries.some(e=>e.address===parseInt(pc,16)),pc+' must be retained');
}
for(const pc of [0xCCEB03,0xCCEB06,0xCCEB14])for(const m8 of [false,true])assert(k.entries.some(e=>e.address===pc&&e.state.m8===m8),'preserve caller M width');
for(const original of require('../reports/bomberman-catalog-provenance-v043691.json').compiled_entry_states){assert(k.entries.some(e=>e.address===parseInt(original.address,16)&&['emulation','m8','x8'].every(x=>e.state[x]===original.state[x])&&(e.state.carry===null||e.state.carry===original.state.carry)),'missing compiled entry state '+JSON.stringify(original));}
assert.equal(C.bundledCfgKnowledge('0000000000000000'),null,'do not inject handlers into another ROM');
assert.throws(()=>C.bundledCfgKnowledge(hash,{...pack,rom:{fnv1a64:'ffffffffffffffff'}}),/ROM fingerprint mismatch/);
const custom={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},entries:[{address:'CCA055',state:{emulation:false,m8:false,x8:false,carry:null},name:'custom_name',priority:2000}]};
const merged=C.bundledCfgKnowledge(hash,custom);assert.equal(merged.entries.filter(e=>e.address===0xCCA055&&!e.state.m8).length,1);assert.equal(merged.entries.find(e=>e.address===0xCCA055).name,'custom_name');
// A known corrected entry must survive a reset callee that consumes the budget.
const b=C.makeSyntheticRom();b.set([0x20,0x20,0x80,0xDB],0);b.fill(0xEA,0x20,0x60);b.set([0xA9,0x42,0x60],0x100);
const sr=C.loadRom(b),sh=C.romFingerprint(sr),sk={schema:'forja65.knowledge.v1',rom:{fnv1a64:sh},entries:[{address:'008100',priority:1000,state:{emulation:true,m8:true,x8:true,carry:null}}]};
const sa=C.analyze(sr,32,[],{knowledge:sk,summaryRounds:1});assert(sa.functions.some(f=>f.start===0x8100),'priority knowledge entry starved by reset descendants');
const ob=C.makeSyntheticRom();ob.set([0xDB],0);ob.set([0x20,0x00,0x81,0x60],0x30);ob.set([0xA9,0x77,0x60],0x100);ob.fill(0xEA,0x200,0x280);
const or=C.loadRom(ob),oh=C.romFingerprint(or),ok={schema:'forja65.knowledge.v1',rom:{fnv1a64:oh},entries:[{address:'008200',priority:1000,state:{emulation:true,m8:true,x8:true,carry:null}}]};
const oa=C.analyze(or,48,[{rom:oh,target:0x8030,from:0x8000,kind:'FLOW',state:{emulation:true,m8:true,x8:true,carry:null},observed:1}],{knowledge:ok,summaryRounds:1});
assert(oa.functions.some(f=>f.start===0x8100),'actual runtime dependency must precede static catalog seeds');
const r=C.loadRom(C.makeSyntheticRom()),a=C.analyze(r,512);assert.equal(a.bundledCfgEntries,0,'other ROM baseline unchanged');
if(process.env.FORJA65_TEST_BOMBER_ROM){
 const rom=C.loadRom(new Uint8Array(fs.readFileSync(process.env.FORJA65_TEST_BOMBER_ROM)));
 assert.equal(C.romFingerprint(rom),hash);
 const a=C.analyze(rom,8192,[],{summaryRounds:2});
 assert.equal(a.bundledCfgEntries,pack.entries.length);assert.equal(a.knowledgeSeedsImported,pack.entries.length);assert.equal(a.knowledgeDataSeedsRejected,0);
 for(const pc of [0xCCA055,0xCCA089,0xCCA070,0xCCA1A2,0xCCA10B,0xCCEB14])assert(a.functions.some(f=>f.start===pc),'ROM callback discovered '+pc.toString(16));
 const files=C.generateProject(rom,a);
 const dispatch=files['src/dispatch.cpp'];assert(dispatch.includes('0xCCA055u'),'generated dispatcher must include observed missing handler');
 assert(dispatch.includes('0xCCEB14u,false,true,false'),'generated dispatcher must preserve M=1 caller');
 fs.mkdirSync('/tmp/f91-real-generated',{recursive:true});
 for(const [n,body] of Object.entries(files)){if(n.startsWith('src/')){fs.mkdirSync(require('node:path').dirname('/tmp/f91-real-generated/'+n),{recursive:true});fs.writeFileSync('/tmp/f91-real-generated/'+n,body);}}
 console.log('REAL_ROM_CATALOG_PASS entries='+a.bundledCfgEntries+' seeds='+a.knowledgeSeedsImported+' decoded='+a.decoded);
}
console.log('BOMBERMAN_CFG_CATALOG_V043691_PASS');
