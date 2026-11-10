const assert=require('assert');
const C=require('../forja65-core.js');
const d=C.makeSyntheticRom();
d[0x1000]=0x60; // $00:9000, rotina intencionalmente nao alcancada sem hint.
const rom=C.loadRom(d,'stable-shards.sfc');
const a0=C.analyze(rom,8192,[]),p0=C.generateProject(rom,a0);
const h='target=009000 from=008000 kind=FLOW e=1 m=1 x=1 c=0\n';
const a1=C.analyze(rom,8192,h),p1=C.generateProject(rom,a1);
assert(a1.instructions.some(i=>i.pc===0x009000),'hint nao adicionou $009000');
assert.strictEqual(String(p0['src/generated.hpp']),String(p1['src/generated.hpp']),'generated.hpp deveria permanecer estavel');
const names=new Set([...Object.keys(p0),...Object.keys(p1)].filter(n=>/^src\/generated_\d+\.cpp$/.test(n)));
let changed=[];for(const n of names)if(String(p0[n]||'')!==String(p1[n]||''))changed.push(n);
assert(changed.length<=2,'hint pequeno alterou shards demais: '+changed.join(','));
assert(String(p1['analysis.json']).includes('"stable_cpp_shards": true'),'metadata stable_cpp_shards ausente');
console.log('OK stable shards',{changed,baseFunctions:a0.cfgFunctions,hintFunctions:a1.cfgFunctions});
