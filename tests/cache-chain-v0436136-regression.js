'use strict';
// REV136: audit behind the .107 -> .103 cache edge in tools/project-io.js.
// The cache stores decoded CFG functions; it is accepted across versions only when
// instruction decoding and per-function CFG decoding are byte-identical.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../forja65-core'),Old=require('../crossfeed-historico/v0436103-pre-crlf/forja65-core'),IO=require('../tools/project-io');
// REV202: o decodificador ativo (.118) mudou de proposito (tabelas inline apos JSL/JSR) e por isso rejeita
// caches antigos. A auditoria historica de texto do decodificador passa a usar a .117 arquivada.
const cur=fs.readFileSync(require.resolve('../crossfeed-historico/v0436117-rev201/forja65-core'),'utf8'),old=fs.readFileSync(require.resolve('../crossfeed-historico/v0436103-pre-crlf/forja65-core'),'utf8');
const part=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,a);return s.slice(i,j);};
for(const [a,b]of [['function decodeOne(','function decodeLinear('],['function decodeCfgFunction(','function runtimeHintKey(']])
 assert.equal(part(cur,a,b),part(old,a,b),'decoder changed since .103; the audited cache edge is no longer valid: '+a);
assert.equal(Old.VERSION,'0.4.36.103-rie-crossfeed');
assert.equal(IO.isAuditedCacheVersion(Old.VERSION,'0.4.36.117-legacy-port-archaeology'),true,'.103 caches accepted up to .117');
assert.equal(IO.isAuditedCacheVersion(Old.VERSION),false,'REV202 must reject pre-.118 CFG caches');
// Every function decoded by .103 is decoded identically by the active core.
for(const code of [[0x18,0xfb,0xc2,0x30,0xa9,0x34,0x12,0xdb],[0x22,0,0x81,0,0xdb],[0x20,0,0x81,0xdb],[0xa2,4,0x7c,0,0x90],[0xf4,0xff,0x81,0x60]]){
 const b=C.makeSyntheticRom();b.set(code);b.set([0xa9,0x17,0x6b],0x100);b.set([0,0x82],0x1004);b[0x200]=0xdb;
 const rom=C.loadRom(b),a=C.analyze(rom,256),o=Old.analyze(Old.loadRom(b),256);
 const key=f=>f.start+'|'+JSON.stringify(f.state),cm=new Map(a.functions.map(f=>[key(f),f]));
 for(const f of o.functions){const g=cm.get(key(f));assert(g,'function lost: '+key(f));assert.deepEqual(g.instructions.map(i=>[i.pc,i.opcode,i.size]),f.instructions.map(i=>[i.pc,i.opcode,i.size]));}
}
assert.equal(IO.isAuditedCacheVersion('0.4.36.95-rie-cfg-global','0.4.36.99-rie-observed-jsr-verified'),false);
console.log('CACHE_CHAIN_V0436136_PASS .103 decoder identical; edge .107->.103 audited');
