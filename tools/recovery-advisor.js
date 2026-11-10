'use strict';
// Read-only recommendations grounded in ROM-specific runtime evidence, CFG and
// approved repair metadata. Never promotes a hypothesis into a proven fix.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Runtime=require('./runtime-evidence-vault');
const Regression=require('./regression-intelligence');
const Repairs=require('./cpp-corrections-vault');
const IO=require('./project-io');
const C=require('../forja65-core');
const Legacy=require('./legacy-port-archaeology');
const SCHEMA='forja65.recovery-advisor.v1';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const isFailure=e=>e?.origin==='native-run'&&['failed','checkpoint-not-reached'].includes(e.status);
const isPass=e=>e?.origin==='native-run'&&e.status==='checkpoint-passed'&&Number.isSafeInteger(e.frames)&&e.frames>0;
function address(x){
 if(typeof x==='number'&&Number.isInteger(x)&&x>=0&&x<=0xffffff)return x;
 if(typeof x!=='string')return null;
 let t=x.trim().toUpperCase();
 if(/^[0-9A-F]{2}:[0-9A-F]{4}$/.test(t))t=t.replace(':','');
 else t=t.replace(/^\$/,'').replace(/^0X/,'');
 return /^[0-9A-F]{4,6}$/.test(t)?parseInt(t,16):null;
}
const addressLabel=a=>a===null?null:'$'+a.toString(16).toUpperCase().padStart(a>0xffff?6:4,'0');
const bounded=n=>Math.min(30,Math.max(1,Number.isInteger(Number(n))?Number(n):10));
function readCfg(project,vault){
 const file=path.join(project,'analysis','cfg-coverage-cache.json');
 let cache=null,source=null;
 try{if(fs.existsSync(file)&&fs.statSync(file).isFile()&&fs.statSync(file).size<=24*1024*1024){
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));
  if(raw.schema==='forja65.cfg-coverage-cache.v1'&&raw.rom===vault.id.fnv1a64&&Array.isArray(raw.functions)){
   if(IO.isAuditedCacheVersion(raw.version)){cache=raw;source='project-compatible';}
   else{source='project-legacy-unverified';}
  }
 }}catch(_) {source='project-cache-unreadable';}
 if(!cache){try{const previous=vault.load({isCompatible:IO.isAuditedCacheVersion});if(previous.cache){cache=previous.cache;source='vault-compatible';}else if(previous.oldCache)source='vault-legacy-unverified';}catch(_) {source='vault-cache-unreadable';}}
 return {cache,source};
}
function contextAt(pc,cache,source){
 const result={pc:addressLabel(pc),cfgSource:source||'not-present',matchedFunctions:[],confirmedCoverage:false};
 if(pc===null||!cache)return result;
 for(const f of cache.functions.slice(0,20000)){
  if(!Number.isInteger(f.start))continue;
  const ins=Array.isArray(f.instructions)?f.instructions:[];
  const direct=f.start===pc;
  const hits=ins.some(i=>i.pc===pc);
  if(direct||hits){result.matchedFunctions.push({start:addressLabel(f.start),kind:direct?'entry':'instruction'});if(result.matchedFunctions.length>=4)break;}
 }
 // CFG is static analysis evidence, never proof of native execution.
 result.decodedInCfg=result.matchedFunctions.length>0;
 return result;
}
function diagnostics(project){
 // Legacy logs may have stale timestamps; expose only as unverified investigation clues.
 const names=['forja65-unresolved-state.txt','forja65-unresolved-targets.txt'];const result=[];
 for(const name of names){const file=path.join(project,name);try{if(!fs.statSync(file).isFile()||fs.statSync(file).size>1024*1024)continue;
  const text=fs.readFileSync(file,'utf8'),lines=text.split(/\r?\n/).filter(Boolean);
  if(lines.length)result.push({file:name,lines:lines.length,samples:lines.slice(0,3).map(s=>s.slice(0,180)),trust:'legacy-unverified'});
 }catch(_) {}}
 return result;
}
function nextAction(e,matched){
 const text=String(e.failureSummary||'')+' '+Object.entries(e.failureState||{}).map(([k,v])=>k+'='+v).join(' ');
 const a=matched.pc,addr=addressLabel(a),actions=[];
 if(e.status==='checkpoint-not-reached')actions.push({domain:'progress',hypothesis:'Checkpoint não alcançado; pode ser execução lenta, travamento ou ausência de métricas de frames.',verify:'Conferir qa-status, contador de frames e o último PC; repetir teste com mesmo checkpoint e limite.',confidence:'low'});
 if(/(?:indirect|indexed|unresolved|jmp|jsl|jsr|rtl|rts|unknown jump|target|dispatch)/i.test(text))actions.push({domain:'cfg-control-flow',hypothesis:'O fluxo de controle ou o destino indireto pode estar ausente do CFG/dispatch.',verify:'Inspecionar a origem e o destino'+(addr?' em '+addr:'')+', estado E/M/X/C e tabela indexada da ROM; comparar o trace com os hints observados.',confidence:addr?'medium':'low'});
 if(/(?:invalid opcode|unknown opcode|illegal instruction|opcode)/i.test(text))actions.push({domain:'cpu-decode',hypothesis:'Decodificação/estado 65816 incorreto ou execução de dados como código.',verify:'Validar bytes da ROM, banco PBR, largura M/X, carry e endereço'+(addr?' '+addr:'')+' antes de modificar instruções.',confidence:addr?'medium':'low'});
 if(/(?:stack|sp=|return|underflow)/i.test(text))actions.push({domain:'cpu-stack',hypothesis:'Retorno de chamada ou profundidade de pilha pode ter divergido.',verify:'Comparar JSR/JSL/RTS/RTL, pilha e mudança de banco nas instruções anteriores.',confidence:'low'});
 if(/(?:ppu|dma|hdma|oam|vram|tile|sprite)/i.test(text))actions.push({domain:'graphics-bus',hypothesis:'Transação de PPU/DMA ou temporização pode ter divergido.',verify:'Comparar escrita na PPU, ordem do barramento e estados de DMA/HDMA com o trace.',confidence:'low'});
 if(/(?:timeout|watchdog|hung|stall|deadlock)/i.test(text))actions.push({domain:'liveness',hypothesis:'Possível loop ou deadlock; o limite de tempo sozinho não identifica a causa.',verify:'Capturar PC e ciclos em janelas sucessivas, conferir IRQ/NMI e fronteiras de dispatch.',confidence:'low'});
 if(!actions.length)actions.push({domain:'triage',hypothesis:'Ainda não há evidência suficiente para identificar a causa da falha.',verify:'Reexecutar com trace de CPU, último PC, estado E/M/X/C, qa-status e crash-trace frescos.',confidence:'low'});
 if(matched.cfgSource?.includes('legacy'))actions.push({domain:'cfg-revalidation',hypothesis:'Existe CFG arquivado, mas de versão não homologada do analisador.',verify:'Reprocessar essas entradas como seeds e validar os saltos na ROM; não executar cache antigo diretamente.',confidence:'low'});
 return actions.slice(0,5);
}
function open(project,{home}={}){
 const runtime=Runtime.open(project,{home}),regress=Regression.open(project,{home}),repairs=Repairs.open(project,{home});
 function report({limit=10,includeClosed=false,inspectSource=true}={}){
  const events=runtime.index().events,guard=regress.check({inspectSource}),frozen=regress.index().baselines;
  const {cache,source}=readCfg(runtime.root,runtime.vault),legacy=diagnostics(runtime.root);
  const oldPorts=Legacy.open(path.join(runtime.root,'assets','cart-data.bin'),{home}),historical=oldPorts.report({limit:10});
  const groups=new Map(),checkpointLatest=new Map();
  for(let i=0;i<events.length;i++){
   const e=events[i];if(e.origin!=='native-run')continue;
   checkpointLatest.set(e.checkpoint,e);
   if(!isFailure(e))continue;
   const key=e.checkpoint+'|'+(e.failureSignature|| (e.status==='checkpoint-not-reached'?'no-frame-evidence':'unclassified:'+e.id));
   if(!groups.has(key))groups.set(key,{checkpoint:e.checkpoint,signature:e.failureSignature||null,events:[],positions:[],latest:null});
   const g=groups.get(key);g.events.push(e.id);g.positions.push(i);g.latest={index:i,event:e};
  }
  const issues=[];
  for(const g of groups.values()){
   const e=g.latest.event,cp=g.checkpoint,next=events.slice(g.latest.index+1).filter(x=>x.checkpoint===cp&&x.origin==='native-run');
   const confirmedLater=next.some(x=>isPass(x)&&x.frames>=Math.max(e.minFrames||0,x.minFrames||0));
   const sameAfter=next.some(x=>isFailure(x)&&x.failureSignature===g.signature);
   const state=confirmedLater&&!sameAfter?'passed-after-failure':'requires-investigation';
   const reopened=g.positions.slice(1).some((at,i)=>events.slice(g.positions[i]+1,at).some(x=>isPass(x)&&x.checkpoint===cp));
   const trend=reopened?'reopened':g.events.length>1?'recurring':'new';
   if(!includeClosed&&state==='passed-after-failure')continue;
   const pc=address(e.failureState?.pc),target=address(e.failureState?.target),reg=guard.details.find(x=>x.checkpoint===cp);
   const p=pc!==null?pc:target;
   const cfg=contextAt(p,cache,source),historicRuns=events.filter(x=>x.checkpoint===cp&&isPass(x)),bestFrames=historicRuns.reduce((m,x)=>Math.max(m,x.frames),0);
   const baseline=frozen[cp]||null;
   let score=30+Math.min(20,(g.events.length-1)*6)+(reg?.status==='regression'?27:0)+(e.status==='failed'?8:0)+(baseline?8:0)+(p!==null?5:0)+(reopened?12:0)-(state==='passed-after-failure'?35:0);
   score=Math.max(1,Math.min(100,score));
   const repairMatches=[];
   // Repairs are ROM-bound, but a shared checkpoint is only correlation, not proof of cause.
   for(const s of events.filter(x=>x.checkpoint===cp&&isPass(x)).slice(-10))for(const match of s.repairCheckpointMatches||[]){
    if(repairMatches.some(x=>x.revision===match.revision))continue;
    repairMatches.push({revision:match.revision,checkpoint:cp,evidenceRun:s.id,relation:'checkpoint-correlation-only'});
   }
   const relatedHistorical=oldPorts.findChangesForPc(p,{limit:8});
   issues.push({id:sha(Buffer.from(g.checkpoint+'|'+(g.signature||e.id))).slice(0,16),checkpoint:cp,priority:score,state,trend,status:e.status,occurrences:g.events.length,firstRun:g.events[0],lastFailureRun:e.id,signature:g.signature,pc:addressLabel(pc),target:addressLabel(target),cpuState:e.failureState||{},lastFrames:e.frames,bestPassingFrames:bestFrames,baselineFrames:baseline?.frames||null,baselineStatus:reg?.status||'none',lastRun:checkpointLatest.get(cp)?.id||null,cfg,possibleRelatedRepairs:repairMatches,relatedHistoricalChanges:relatedHistorical,actions:nextAction(e,{pc:p,cfgSource:source}),evidence:['native runtime journal '+e.id,baseline?'approved baseline '+baseline.eventId:null,cfg.decodedInCfg?'compatible static CFG':null].filter(Boolean)});
  }
  issues.sort((a,b)=>b.priority-a.priority||a.checkpoint.localeCompare(b.checkpoint)||a.id.localeCompare(b.id));
  return {schema:SCHEMA,rom:runtime.vault.id,sourceProject:path.basename(runtime.root),runtimeEvents:events.length,nativeRuns:events.filter(e=>e.origin==='native-run').length,baselineCount:Object.keys(frozen).length,openIssues:issues.filter(x=>x.state==='requires-investigation').length,closedCandidates:issues.filter(x=>x.state!=='requires-investigation').length,staleDiagnostics:legacy,knowledge:{cfgSource:source||'none',compatibleCfgFunctions:cache?.functions?.length||0,repairRevisions:repairs.plans().revisions,legacySnapshots:historical.storedSnapshots,legacyComparisons:historical.storedComparisons},issues:issues.slice(0,bounded(limit)),limitations:['As hipóteses não demonstram a causa raiz.','Passar um checkpoint não prova que um crash específico foi corrigido.','CFG compatível representa decodificação estática, não gameplay validado.','Registros históricos importados não são testes nativos novos.','Diferenças de fontes entre ports antigos são pistas, não reparos validados nem prova causal.']};
 }
 function save({limit=10,includeClosed=false,inspectSource=true}={}){
  const data=report({limit,includeClosed,inspectSource});
  const folder=path.join(runtime.vault.folder,'recovery-advisor'),file=path.join(folder,'latest.json');
  const summary={...data,sourceProject:undefined};
  const json=JSON.stringify(summary,null,2)+'\n',digest=sha(Buffer.from(json));
  fs.mkdirSync(folder,{recursive:true});
  if(fs.existsSync(file)&&sha(fs.readFileSync(file))===digest)return {report:data,saved:false,path:file};
  const snapshot=path.join(folder,'snapshots',digest+'.json');fs.mkdirSync(path.dirname(snapshot),{recursive:true});
  if(!fs.existsSync(snapshot))fs.writeFileSync(snapshot,json,{flag:'wx'});
  const tmp=file+'.'+process.pid+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';
  try{fs.writeFileSync(tmp,json,{flag:'wx'});fs.renameSync(tmp,file);}finally{try{fs.unlinkSync(tmp);}catch(_){}}
  return {report:data,saved:true,path:file};
 }
 return {report,save};
}
module.exports={SCHEMA,open,address,addressLabel};
