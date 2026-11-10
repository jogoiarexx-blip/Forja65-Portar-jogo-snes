'use strict';
const assert=require('node:assert/strict'),F=require('../forja65-core');
let supported=0;
for(let op=0;op<256;op++){
 const data=new Uint8Array(65536);data[0x200]=op;
 const i=F.spcDecodeOne({data},0x200);
 if(i.status==='native')supported++;
}
assert.equal(supported,256,'all SPC700 opcodes must have a compiled semantic specialization');
const data=new Uint8Array(65536);data.set([0x8d,3,0xcf,0xff],0x200);
const cap=F.loadSpcCapture(data,'entry_candidate=512'),a=F.spcAnalyze(cap,64);
assert.equal(a.unsupported,0);assert(a.instructions.some(i=>i.opcode===0xcf));
const src=F.spcCpp(cap,a);
assert(!src.includes('static SpcCpuState cpu'),'native state must belong to ApuBridge');
// Independent encoding check: non-control instructions advance PC by their
// documented length in the external SingleStepTests vectors.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const vectors=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/spc700-rev132-fixture.json.gz'))));
const flow=new Set([0x0f,0x1f,0x2f,0x3f,0x4f,0x5f,0x6f,0x7f,0xef,0xff,0x10,0x30,0x50,0x70,0x90,0xb0,0xd0,0xf0,0x2e,0xde,0x6e,0xfe]);
const checked=new Set();
for(const t of vectors){
 const op=Number.parseInt(t.name.slice(0,2),16);if(flow.has(op)||(op&15)===1||(op&15)===3)continue;
 const bytes=new Uint8Array(65536);for(const [a,v]of t.initial.ram)bytes[a]=v;
 const decoded=F.spcDecodeOne({data:bytes},t.initial.pc);
 assert.equal(decoded.size,(t.final.pc-t.initial.pc)&65535,'encoding length '+t.name);
 checked.add(op);
}
assert(checked.size>=200);
console.log('SPC_AOT_REV140_METADATA_PASS opcodes=256');
