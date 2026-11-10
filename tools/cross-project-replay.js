'use strict';
// Import ROM-bound DKC3 runtime *observations* into Forja65; never import
// symbolic names / static candidates as runtime proof or native equivalence.
const crypto = require('crypto');
const C = require('../forja65-core');
function a24(value) {
  if(typeof value==='number' && Number.isInteger(value) && value>=0 && value<=0xffffff)return value;
  if(typeof value==='string' && /^(?:0x)?[0-9a-f]{1,6}$/i.test(value))return parseInt(value.replace(/^0x/i,''),16);
  throw new Error('Endereco 65816 invalido: '+String(value));
}
const h = n=>n.toString(16).toUpperCase().padStart(6,'0');
function flags(s) {
  if(!s||typeof s!=='object')throw Error('Estado da CPU ausente');
  const get = (keys) => {const k=keys.find(k=>Object.prototype.hasOwnProperty.call(s,k));if(k===undefined||![0,1,true,false].includes(s[k]))throw Error('Flag E/M/X/C nao comprovado: '+keys.join('/'));return Number(s[k]);};
  return {e:get(['e','E']),m:get(['m','M']),x:get(['x','X8','x8']),c:get(['c','C'])};
}
function parseTraceTail(str,expectedSite) {
  const lines=String(str).trim().split(/\r?\n/).filter(Boolean);
  const last=[...lines].reverse().find(line=>/^[0-9a-f]{6} A=/i.test(line));
  if(!last)throw Error('Trace da CPU nao contem ultimo PC/flags');
  const pc=a24(last.split(' ')[0]);
  if(pc!==expectedSite)throw Error('Ultimo PC do trace nao confere com o desvio registrado');
  const match=last.match(/\bE=([01])\s+M=([01])\s+X8=([01])\s+C=([01])\b/i);
  if(!match)throw Error('Trace sem estado E/M/X/C');
  return flags({e:Number(match[1]),m:Number(match[2]),x:Number(match[3]),c:Number(match[4])});
}
function parseStateLog(str,expected) {
  const lines=String(str).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const regex=/^([0-9a-f]{1,6})\s*->\s*([0-9a-f]{1,6})\s+e=([01])\s+m=([01])\s+x=([01])\s+c=([01])$/i;
  const matching=lines.map(line=>regex.exec(line)).filter(Boolean).filter(m=>a24(m[1])===a24(expected.pc)&&a24(m[2])===a24(expected.destination));
  if(matching.length!==1)throw Error('Log STATE ausente ou ambiguo para o evento relatado');
  const r=matching[0],f=flags({e:Number(r[3]),m:Number(r[4]),x:Number(r[5]),c:Number(r[6])});
  const e=flags(expected);
  if(Object.keys(f).some(k=>f[k]!==e[k]))throw Error('Log STATE diverge da integracao');
  return f;
}
function record(kind,from,target,state,source) {
  return {kind,from,target,flags:state,source,evidence:'observed runtime failure; not native/handler semantic proof'};
}
function verifyFlowError(str,site,target) {
  const m=String(str).match(/fluxo CFG nao resolvido em pc=(\d+) target=(\d+)/i);
  if(!m||Number(m[1])!==site||Number(m[2])!==target)throw Error('Erro FLOW nao confirma PC e destino do catalogo');
}
function makeCrossfeed({romBytes,integration,traceText,errorText,priorTraceText,priorErrorText,stateText,knowledge,followupTraceText,followupErrorText}) {
  const data=Buffer.from(romBytes);
  const rom=C.loadRom(new Uint8Array(data),'cart.sfc');
  const fnv=C.romFingerprint(rom),sha=crypto.createHash('sha256').update(rom.data).digest('hex');
  const id=integration&&integration.rom||{};
  if(integration.schema!=='dkc3.bidirectional-evidence.v1')throw Error('Schema de integracao nao reconhecido');
  if(id.sha256!==sha||id.fnv1a64!==fnv||id.bytes!==rom.data.length)throw Error('ROM do replay diverge da ROM informada');
  if(!knowledge||knowledge.schema!=='forja65.knowledge.v1'||knowledge.rom?.sha256!==sha||knowledge.rom?.fnv1a64!==fnv)throw Error('Catalogo Native pertence a ROM diferente');
  const pack=C.normalizeKnowledgePack(knowledge,fnv);
  const later=integration.zero_to_native?.later_observed_flow;
  if(!later||later.semantic_equivalence_proven!==false)throw Error('Falta observacao explicitamente nao-semantic-proof');
  const site=a24(later.site),target=a24(later.target);
  verifyFlowError(errorText,site,target);
  const f=parseTraceTail(traceText,site);
  const obs=[record('FLOW',site,target,f,'ZERO replay: trace PC + failure-site, target from integration')];
  if(priorTraceText!==undefined && priorTraceText!==null){
    const prior=integration.zero_to_native.latest_recorded_flow;
    if(!prior||prior.evidence_level!=='ZERO runtime observed; not native semantic proof')throw Error('Evento anterior nao marcado como observacao real');
    verifyFlowError(priorErrorText,a24(prior.from),a24(prior.target));
    const pf=parseTraceTail(priorTraceText,a24(prior.from)), expected=flags(prior.flags);
    if(Object.keys(pf).some(k=>pf[k]!==expected[k]))throw Error('Trace anterior difere dos flags do evento');
    obs.push(record('FLOW',a24(prior.from),a24(prior.target),pf,'ZERO earlier replay: CPU trace + ROM-bound flow'));
  }
  if(stateText!==undefined&&stateText!==null){
    const state=integration.zero_to_native.latest_recorded_cpu_failure;
    if(!state)throw Error('Integracao sem falha STATE');
    obs.push(record('STATE',a24(state.pc),a24(state.destination),parseStateLog(stateText,state),'ZERO replay: state error log'));
  }
  if(followupTraceText!==undefined && followupTraceText!==null || followupErrorText!==undefined && followupErrorText!==null){
    if(typeof followupTraceText!=='string'||typeof followupErrorText!=='string')throw Error('Followup exige trace e erro reais');
    const m=followupErrorText.match(/fluxo CFG nao resolvido em pc=(\d+) target=(\d+)/i);
    if(!m)throw Error('Followup nao contem destino FLOW reconhecido');
    const nextSite=Number(m[1]),nextTarget=Number(m[2]);
    if(!Number.isSafeInteger(nextSite)||!Number.isSafeInteger(nextTarget)||nextSite>0xffffff||nextTarget>0xffffff)throw Error('Followup fora do endereco 65816');
    obs.push(record('FLOW',nextSite,nextTarget,parseTraceTail(followupTraceText,nextSite),'ZERO replay: observed followup CPU trace and error log'));
  }
  for(const o of obs)if(C.snesToRom(rom,o.target)===null || C.snesToRom(rom,o.from)===null)throw Error('Endereco FLOW/STATE fora da ROM: '+h(o.target));
  // Keep original static knowledge, add two high-priority observed CPU entry states.
  // No automatic handler implementation, no fabricated trampoline domain.
  const entries=[...pack.entries];
  for(const o of obs){
    const existing=entries.find(e=>e.address===o.target && e.state.emulation===!!o.flags.e && e.state.m8===!!o.flags.m && e.state.x8===!!o.flags.x && e.state.carry===!!o.flags.c);
    const candidate=pack.entries.find(e=>e.address===o.target);
    entries.push({address:o.target,name:candidate?.name||('OBSERVED_'+h(o.target)),aliases:[],category:candidate?.category||'UNKNOWN',state:{emulation:!!o.flags.e,m8:!!o.flags.m,x8:!!o.flags.x,carry:!!o.flags.c},priority:95,source:'observed-zero-replay',evidence:[o.evidence],span:null});
  }
  const updated=C.normalizeKnowledgePack({...pack,entries,producer:{tool:'Forja65 cross-project replay',source_schema:integration.schema}},fnv);
  const lines=obs.map(o=>`rom=${fnv} target=${h(o.target)} from=${h(o.from)} kind=${o.kind} e=${o.flags.e} m=${o.flags.m} x=${o.flags.x} c=${o.flags.c} observed=1`);
  return {hints:lines.join('\n')+'\n',knowledge:updated,report:{schema:'forja65.cross-project-replay.v1',rom:{sha256:sha,fnv1a64:fnv,bytes:rom.data.length},observations:obs.map(o=>({...o,from:h(o.from),target:h(o.target)})),static_catalog_entries:pack.entries.length,imported_runtime_observations:obs.length,limits:['Imported observations are valid only for this ROM and recorded CPU flags.','A decoded routine or static name does not prove handler equivalence.','Re-analysis and deterministic replay are required before claiming gameplay progress.']}};
}
module.exports={makeCrossfeed,parseTraceTail,parseStateLog};
