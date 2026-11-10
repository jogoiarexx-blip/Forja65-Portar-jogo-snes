const assert=require('assert');
const C=require('../forja65-core.js');
const d=C.makeSyntheticRom();
const targets=[];
for(let i=0;i<20;i++){
  const t=0x009000+i*4; targets.push(t);
  const off=0x1000+i*4; d[off]=0x60; // RTS: handler plausivel.
  const raw=((t&0xFFFF)-1)&0xFFFF, at=0x2000+i*4;
  d[at]=raw&255; d[at+1]=(raw>>>8)&255; d[at+2]=(t>>>16)&255; d[at+3]=0;
}
const rom=C.loadRom(d,'table-aware-hints.sfc');
const hints=[
  `target=${C.hex(targets[3],6)} from=00B000 kind=STACK-RTL e=1 m=1 x=1 c=0`,
  `target=${C.hex(targets[15],6)} from=00B000 kind=STACK-RTL e=1 m=1 x=1 c=0`,
  `target=${C.hex(targets[15],6)} from=00B000 kind=STACK-RTL e=1 m=1 x=1 c=0`
].join('\n')+'\n';
const a=C.analyze(rom,8192,hints);
assert(a.instructions.some(i=>i.pc===targets[3]),'primeiro alvo observado ausente');
assert(a.instructions.some(i=>i.pc===targets[15]),'segundo alvo observado ausente');
const issues=a.issues.filter(x=>x.kind==='RUNTIME-HINT-TABLE');
assert(issues.length>=2,'tabela STACK-RTL nao foi reconhecida');
const added=issues.map(x=>{const m=x.detail.match(/adicionou (\d+) vizinho/);return m?+m[1]:999;});
assert(added[0]<=11,'primeiro hint expandiu vizinhos demais: '+added[0]);
assert(added[1]<=3,'segundo hint da mesma tabela expandiu vizinhos demais: '+added[1]);
assert(a.cfgFunctions<80,'hints da mesma tabela explodiram o CFG: '+a.cfgFunctions);
const p=C.generateProject(rom,a);
const meta=JSON.parse(p['analysis.json']);
assert(meta.hardware.runtime_return_table_dedup===true,'metadata de deduplicacao ausente');
assert(meta.hardware.runtime_return_table_observed_state===true,'metadata de estado observado ausente');
console.log('OK table-aware runtime hints',{added,functions:a.cfgFunctions,decoded:a.decoded});
