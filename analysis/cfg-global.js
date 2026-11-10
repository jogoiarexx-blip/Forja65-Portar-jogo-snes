// Metadata and worklist planning only. All decoding uses the existing core.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Forja65CfgGlobal=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SCHEMA='forja65.cfg-global.v1',REVISION=1,FRONTIER_LIMIT=1024;
const stateValid=s=>s&&typeof s.emulation==='boolean'&&typeof s.m8==='boolean'&&typeof s.x8==='boolean'&&(s.carry===null||typeof s.carry==='boolean')&&(!s.emulation||(s.m8&&s.x8));
const sig=s=>[+s.emulation,+s.m8,+s.x8,s.carry===null?'?':+s.carry].join('');
const key=(pc,s)=>pc+'|'+sig(s);
function coverage(functions){const map=new Map();for(const f of functions||[])for(const i of f.instructions||[]){if(!stateValid(i.stateIn))continue;const rows=map.get(i.pc)||[];rows.push(i.stateIn);map.set(i.pc,rows);}return map;}
function entryCoverage(functions){return coverage((functions||[]).map(f=>({...f,instructions:(f.instructions||[]).filter(i=>typeof i.stateKey==='string'?i.stateKey.endsWith('|S:'):i.pc===f.start)})));}
function covered(map,pc,s){return (map.get(pc)||[]).some(t=>t.emulation===s.emulation&&t.m8===s.m8&&t.x8===s.x8&&(t.carry===null||t.carry===s.carry));}
const dataMaps=new WeakMap();
function dataRanges(rom,regions,bus){
 const prior=dataMaps.get(regions);if(prior&&prior.rom===rom)return prior.ranges;
 const ranges=[];let visits=0,exhausted=false;
 function walk(start,end){if(exhausted)return;if(++visits>65536){exhausted=true;return;}const lo=bus(start),hi=bus(end);if(lo===null&&hi===null)return;if(lo!==null&&hi!==null&&hi-lo===end-start){ranges.push([lo,hi]);return;}if(start===end){if(lo!==null)ranges.push([lo,lo]);return;}const mid=Math.floor((start+end)/2);walk(start,mid);walk(mid+1,end);}
 // 8 KiB boundaries include every supported SRAM/DSP/base mapper window.
 // Split non-power-of-two physical mirrors instead of assuming bank linearity.
 for(const r of regions){for(let start=r.start;start<=r.end&&!exhausted;){const end=Math.min(r.end,(Math.floor(start/8192)+1)*8192-1);walk(start,end);start=end+1;}if(exhausted)break;}
 if(exhausted){ranges.length=0;ranges.push([0,rom.data.length-1]);} // Conservatively suppress new seeds when guard budget is exhausted.
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const r of ranges){const last=merged[merged.length-1];if(last&&r[0]<=last[1]+1)last[1]=Math.max(last[1],r[1]);else merged.push(r);}
 dataMaps.set(regions,{rom,ranges:merged});return merged;
}
function inData(rom,pc,regions,bus){if(!regions.length)return false;const off=bus(pc);return off!==null&&dataRanges(rom,regions,bus).some(r=>off>=r[0]&&off<=r[1]);}
function planRoots(rom,services,regions=[]){
 const native=[];for(const m8 of [true,false])for(const x8 of [true,false])native.push({emulation:false,m8,x8,carry:null});
 const emu=[{emulation:true,m8:true,x8:true,carry:null}],specs=[['COP-NATIVE',0xffe4,native],['BRK-NATIVE',0xffe6,native],['ABORT-NATIVE',0xffe8,native],['COP-EMU',0xfff4,emu],['ABORT-EMU',0xfff8,emu]];
 const roots=[],rejected=[],seen=new Set(services.existing.map(e=>key(e.target,e.state)));
 // The Cx4 on LoROM MMX2/MMX3 occupies bank 00-3F/80-BF:$6000-$7FFF,
 // which does not overlap the CPU vectors at $FFE4-$FFF8 or their $8000+
 // targets. Vector-root discovery decodes *65C816* code only; it NEVER
 // claims to disassemble the Cx4 DSP. Other unsupported chips remain gated.
 if(rom.header.coprocessor&&!['NONE','DSP1'].includes(rom.header.coprocessor) &&
    !(rom.header.coprocessor==='CX4'&&rom.header.mapping==='LoROM'))
   return {roots,rejected:[{reason:'unsupported-coprocessor-base-map-only'}]};
 for(const [name,vector,states]of specs){const lo=services.bus(vector),hi=services.bus(vector+1);if(lo===null||hi===null){rejected.push({name,vector,reason:'unmapped-vector'});continue;}
  const target=rom.data[lo]|rom.data[hi]<<8;
  if(target<0x8000||!services.executable(target)||services.bus(target)===null||inData(rom,target,regions,services.bus)){rejected.push({name,vector,target,reason:'invalid-or-data-target'});continue;}
  for(const state of states){const k=key(target,state);if(seen.has(k))continue;seen.add(k);roots.push({start:target,state:{...state},entryName:'RIE-VECTOR:'+name,vector,evidence:'hardware-vector',confidence:0.95});}
 }
 return {roots,rejected};
}
function frontier(rom,a,services,regions=[],allowLiveInferred=false){
 const map=entryCoverage(a.functions),seen=new Set(),records=[],sources=new Map(),proofs=new WeakMap();let truncated=0,rejected=0;
 const control=new Set(['JSR','JSL','JMP','JML','RTS','RTL','BRK','COP','PEA']);
 for(const f of a.functions||[])for(const i of f.instructions||[]){if(!control.has(i.mnemonic)||!Array.isArray(i.raw)||i.raw.length!==i.size||i.size<1||i.size>4)continue;
  const matches=i.raw.every((byte,n)=>{const at=services.bus((i.pc&0xff0000)|((i.pc+n)&65535));return at!==null&&rom.data[at]===byte;});if(matches&&stateValid(i.stateIn)){try{const fresh=services.decodeSource(i.pc,i.stateIn);const rows=sources.get(i.pc)||[];rows.push({...fresh,liveInstruction:i,liveFunction:f});sources.set(i.pc,rows);}catch(_){/* Invalid cached source cannot create a new entry. */}}
 }

 for(const f of a.functions||[])for(const c of f.calls||[]){const s=c.state;if(stateValid(s)&&covered(map,c.target,s))continue;
  const sourceMatches=stateValid(s)&&(sources.get(c.from)||[]).some(i=>{
   if(['JSR','JSL','BRK','COP'].includes(c.kind))return i.mnemonic===c.kind&&i.flowTarget===c.target&&stateValid(i.stateOut)&&sig(i.stateOut)===sig(s);
   const expected={'JSR-TABLE':'JSR','JMP-TABLE':'JMP','JML-RAM-VECTOR':'JMP','RIE-RTS':'RTS','RIE-RTL':'RTL'};
   if(expected[c.kind]===i.mnemonic&&i.liveInstruction.rieIndirect?.witness?.length){
    let proof;if(allowLiveInferred)proof=i.liveInstruction.rieIndirect;else{proof=proofs.get(i.liveInstruction);if(!proof){proof=services.replay(i.liveInstruction.rieIndirect.witness);proofs.set(i.liveInstruction,proof);}}
    if(proof?.source?.pc===c.from&&proof.source.mnemonic===i.mnemonic&&proof.source.mode===i.mode&&stateValid(proof.source.state)&&sig(proof.source.state)===sig(s)&&proof.targets.includes(c.target))return true;
   }
   // Only fresh analyzeBase output may reuse its existing inferred evidence.
   // Cache import never enables this branch; cached inference must be reproved.
   if(!allowLiveInferred)return false;
   const old=i.liveInstruction,fn=i.liveFunction,indirectKinds={'JSR-TABLE':'JSR','JMP-TABLE':'JMP','JML-RAM-VECTOR':'JMP'};
   if(indirectKinds[c.kind])return i.mnemonic===indirectKinds[c.kind]&&/Indirect/.test(i.mode)&&(old.indirectTargets||[]).includes(c.target)&&stateValid(old.stateOut)&&sig(old.stateOut)===sig(s);
   if(['STACK-PEA-BOOTSTRAP','STACK-RTS-LOWBYTE-TABLE','STACK-RTS-PEI'].includes(c.kind))return i.mnemonic===(c.kind==='STACK-PEA-BOOTSTRAP'?'PEA':'RTS')&&[...(fn.stackBootstrapTargets||[]),...(fn.stackReturnTargets||[])].some(t=>t.from===c.from&&t.target===c.target&&t.kind===c.kind&&stateValid(t.state)&&sig(t.state)===sig(s));
   return false;
  });
  if(!sourceMatches||!stateValid(s)||!Number.isInteger(c.from)||!Number.isInteger(c.target)||c.target<0||c.target>0xffffff||!services.executable(c.target)||services.bus(c.from)===null||services.bus(c.target)===null||inData(rom,c.target,regions,services.bus)){rejected++;continue;}
  if(covered(map,c.target,s))continue;const k=key(c.target,s);if(seen.has(k))continue;seen.add(k);
  if(records.length>=FRONTIER_LIMIT){truncated++;continue;}
  records.push({start:c.target,from:c.from,state:{...s},kind:c.kind||'CFG-CALL',entryName:'RIE-FRONTIER',evidence:'existing-cfg-call',confidence:0.8});
 }
 return {records,truncated,rejected};
}
function validateFrontier(rom,cache,services,regions=[]){
 const actual=frontier(rom,cache,services,regions),candidates=new Map(actual.records.map(r=>[key(r.start,r.state)+'|'+r.from,r]));const seeds=[],seen=new Set();let rejected=0;
 for(const r of (cache.cfgFrontier||[]).slice(0,FRONTIER_LIMIT)){
  if(!r||!stateValid(r.state)||!Number.isInteger(r.start)||!Number.isInteger(r.from)){rejected++;continue;}
  const match=candidates.get(key(r.start,r.state)+'|'+r.from);if(!match){rejected++;continue;}
  const k=key(match.start,match.state);if(!seen.has(k)){seen.add(k);seeds.push(match);}
 }
 return {seeds,rejected,truncated:Math.max(0,(cache.cfgFrontier||[]).length-FRONTIER_LIMIT)};
}
function markHintsCached(hints,functions){const map=coverage(functions);return (hints||[]).map(h=>({...h,cachedCoverage:covered(map,h.target,h.state)}));}
function markdown(a){const g=a.rieGlobal;if(!g)return '';return ['ROM Intelligence — CFG Global',`Raizes de vetores adicionadas: ${g.roots.length}`,`Rodadas extras: ${g.expansionRounds}; orcamento extra: ${g.extraBudget}`,`Enderecos antes/depois: ${g.initialDecoded}/${a.decoded}; novos: ${g.addedInstructions}`,`Chamadas pendentes: ${(a.cfgFrontier||[]).length}; fronteiras omitidas pelo limite: ${g.frontierTruncated}`, 'Evidencia: analise estatica; nao equivale a validacao em execucao.',''].join('\n');}
return {SCHEMA,REVISION,FRONTIER_LIMIT,stateValid,inData,coverage,entryCoverage,covered,planRoots,frontier,validateFrontier,markHintsCached,markdown};
});
