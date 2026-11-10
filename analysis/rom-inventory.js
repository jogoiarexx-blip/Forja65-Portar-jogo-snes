// Observational ROM inventory. No decoder, CFG seeds or runtime execution here.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Forja65RomInventory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SCHEMA='forja65.rom-inventory.v1',REVISION=1;
const CLASS=['unknown','data','probableCode','data','data','unknown'];
const EVIDENCE=['unclassified','uniform-padding','existing-cfg','knowledge-data','header-or-vector','code-data-conflict'];
const CONFIDENCE=[0,0.6,0.8,0.95,0.99,0];
const VECTOR_SPECS=[['COP-NATIVE',0xffe4],['BRK-NATIVE',0xffe6],['ABORT-NATIVE',0xffe8],['NMI-NATIVE',0xffea],['IRQ-NATIVE',0xffee],['COP-EMU',0xfff4],['ABORT-EMU',0xfff8],['NMI-EMU',0xfffa],['RESET',0xfffc],['IRQ-BRK-EMU',0xfffe]];
const limit=(v,def,cap)=>v===undefined?def:Number.isFinite(Number(v))?Math.max(1,Math.min(cap,Math.trunc(Number(v)))):def;
// Overlay bus precedence from SnesRuntime, while reusing the existing ROM mapper.
// This does not add support for cartridge chips with programmable mapping.
function busOffset(rom,map,a){
 const h=rom.header,b=(a>>>16)&255,lo=a&65535;
 if(h.sramBytes){
  if(h.mapping==='LoROM'&&((b>=0x70&&b<=0x7d)||b>=0xf0)&&lo<=((h.romSize>11||h.sramSize>5)?0x7fff:0xffff))return null;
  if((h.mapping==='HiROM'||h.mapping==='ExHiROM')&&((b>=0x20&&b<=0x3f)||(b>=0xa0&&b<=0xbf))&&lo>=0x6000&&lo<=0x7fff)return null;
 }
 if(h.coprocessor==='DSP1'){
  if(h.mapping==='LoROM'){
   if(rom.data.length>0x100000){if(((b>=0x60&&b<=0x6f)||(b>=0xe0&&b<=0xef))&&lo<=0x7fff)return null;}
   else if(((b>=0x20&&b<=0x3f)||(b>=0xa0&&b<=0xbf))&&lo>=0x8000)return null;
  }else if(((b<=0x1f)||(b>=0x80&&b<=0x9f))&&lo>=0x6000&&lo<=0x7fff)return null;
 }
 return map(rom,a);
}
function build(rom,services,analysis=null,options={}){
 const data=rom.data,size=data.length,h=rom.header,map=services.map,at=a=>busOffset(rom,map,a),cap=limit(options.maxRecords,8192,65536),regionCap=limit(options.maxRegions,32768,131072);
 const supported=['LoROM','HiROM','ExHiROM'].includes(h.mapping),scope=!supported?'unsupported':h.coprocessor&& !['NONE','DSP1'].includes(h.coprocessor)?'base-mapper-only':'runtime-base-map';
 const labels=new Uint8Array(size),identified=new Uint8Array(size),translated=new Uint8Array(size),hist=new Uint16Array(256);
 const counts={unknown:0,data:0,probableCode:0,confirmedCode:0},truncated={regions:0,vectors:0,functions:0,references:0,indirectSites:0,banks:0,bankWindows:0};
 const inv={schema:SCHEMA,revision:REVISION,analyzer:services.version,rom:{fnv1a64:services.hash,size,copierHeader:!!rom.copierHeader,title:h.title||rom.name},mapping:{kind:h.mapping,scope,complete:supported,headerOffset:h.headerOffset,candidates:(rom.candidates||[]).map(c=>({kind:c.mapping,headerOffset:c.headerOffset,score:c.score})),ambiguous:(rom.candidates||[]).length>1&&rom.candidates[0].score===rom.candidates[1].score},inputs:{dataRegions:[]},classificationBytes:counts,metrics:{inventoriedBytes:size,identifiedCodeBytes:0,translatableBytes:0,executionValidatedBytes:0,compiledValidatedBytes:0,conflictBytes:0,lowEntropyPages:0,pagesScanned:0,meanEntropy:0,mappedPhysicalBytes:0,unmappedPhysicalBytes:0,temporaryByteArrays:size*3+hist.byteLength,physicalBytesScanned:0,pagesReused:0},regions:[],banks:[],vectors:[],functions:[],references:[],indirectSites:[],truncated,limits:{maxRecords:cap,maxRegions:regionCap,maxMappingWindows:limit(options.maxMappingWindows,8192,65536)},notes:[
  'Inventory is not code discovery, recompilation coverage or gameplay validation.',
  'CFG bytes are probable code; translatable bytes have emitter support, not execution proof.',
  'FNV-1a64 is the existing ROM identity, not a cryptographic integrity guarantee.',
  'Uniform 00/FF pages are probable padding; graphics/audio without evidence remain unknown.',
  'Persistent cache reuses physical page statistics; CFG evidence is overlaid fresh, without additional seeds.'
 ]};
 const push=(kind,value)=>{if(inv[kind].length<cap)inv[kind].push(value);else truncated[kind]++;};
 // Persist only ROM-derived pages. CFG/hints/data evidence is overlaid afresh.
 // Content identity, analyzer version and scan revision invalidate all old pages.
 const cacheKey=SCHEMA+':scan:'+REVISION+':'+services.version+':'+services.hash+':'+size;
 const cache=options.cache,expectedPages=Math.ceil(size/256);let pages=null;
 inv.cache={status:cache?'miss':'disabled',key:cacheKey,scope:'physical-page-statistics'};
 if(cache)try{const text=cache.getItem(cacheKey);if(text){const old=JSON.parse(text);if(old.schema===SCHEMA&&old.revision===REVISION&&old.analyzer===services.version&&old.rom===services.hash&&old.size===size&&Array.isArray(old.pages)&&old.pages.length===expectedPages&&old.pages.every(p=>Array.isArray(p)&&p.length===2&&(p[0]===null||p[0]===0||p[0]===255)&&Number.isFinite(p[1])&&p[1]>=0&&p[1]<=8)){pages=old.pages;inv.cache.status='hit';}}}catch(_){inv.cache.status='read-error';}
 if(!pages){pages=[];
  for(let start=0;start<size;start+=256){const end=Math.min(size,start+256),len=end-start;hist.fill(0);for(let p=start;p<end;p++)hist[data[p]]++;
   let entropy=0;for(const n of hist)if(n){const p=n/len;entropy-=p*Math.log2(p);}pages.push([hist[0]===len?0:hist[255]===len?255:null,entropy]);inv.metrics.pagesScanned++;
  }
  inv.metrics.physicalBytesScanned=size;
  if(cache)try{cache.setItem(cacheKey,JSON.stringify({schema:SCHEMA,revision:REVISION,analyzer:services.version,rom:services.hash,size,pages}));}catch(_){inv.cache.status+='-write-error';}
 }else inv.metrics.pagesReused=pages.length;
 let weightedEntropy=0;
 for(let n=0;n<pages.length;n++){const [padding,entropy]=pages[n],start=n*256,end=Math.min(size,start+256);weightedEntropy+=entropy*(end-start);if(entropy<1)inv.metrics.lowEntropyPages++;if(padding!==null)labels.fill(1,start,end);}
 inv.metrics.meanEntropy=size?weightedEntropy/size:0;
 // Describe every CPU bank and ROM alias; split at runtime bus boundaries.
 // Recursion handles partial/non-power-of-two image mirrors without assuming
 // cartridge offsets are contiguous merely because CPU addresses are.
 const physical=[];let mappingVisits=0;const visitLimit=inv.limits.maxMappingWindows*8+2048;
 if(supported)for(let bank=0;bank<256;bank++){
  const windows=[];
  const walk=(start,end)=>{if(physical.length>=inv.limits.maxMappingWindows||mappingVisits++>=visitLimit){inv.mapping.complete=false;truncated.bankWindows++;return;}const first=at(start),last=at(end-1);
   if(first===null&&last===null)return;
   if(first!==null&&last!==null&&last-first===end-start-1){windows.push({start,end,romStart:first});physical.push([first,first+end-start]);return;}
   if(end-start===1){if(first!==null){windows.push({start,end,romStart:first});physical.push([first,first+1]);}return;}
   const mid=start+Math.floor((end-start)/2);walk(start,mid);walk(mid,end);
  };
  // All bus overlays above change only at these boundaries.
  for(const [lo,hi]of [[0,0x2000],[0x2000,0x6000],[0x6000,0x8000],[0x8000,0x10000]])walk(bank*65536+lo,bank*65536+hi);
  if(windows.length)inv.banks.push({bank,windows});
 }
 physical.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let lastEnd=0;for(const [start,end]of physical){if(end>lastEnd){inv.metrics.mappedPhysicalBytes+=end-Math.max(start,lastEnd);lastEnd=end;}}
 inv.metrics.unmappedPhysicalBytes=inv.mapping.complete?size-inv.metrics.mappedPhysicalBytes:null;
 if(!inv.mapping.complete&&supported)inv.notes.push('Mapping window budget exhausted: mapped byte count is a lower bound; unmapped byte count is unknown.');
 if(scope==='base-mapper-only')inv.notes.push('Unsupported cartridge chip: bank windows describe only the base mapper; programmable mapping is not modeled.');
 if(!supported)inv.notes.push('Unsupported mapper: no CPU bank windows claimed.');
 const mark=(off,code)=>{if(off!==null&&off>=0&&off<size)labels[off]=code;};
 // Only selected header fields are structural data. Reserved vector bytes can
 // contain executable reset stubs and must not be blanket-classified as data.
 if(Number.isInteger(h.headerOffset)&&h.headerOffset>=0&&h.headerOffset+32<=size)labels.fill(4,h.headerOffset,h.headerOffset+32);
 for(const [name,address]of VECTOR_SPECS){const lo=at(address),hi=at(address+1);if(lo===null||hi===null){push('vectors',{name,address,target:null,valid:false,reason:'unmapped-vector'});continue;}
  mark(lo,4);mark(hi,4);const target=data[lo]|(data[hi]<<8),valid=target>=0x8000&&at(target)!==null&&services.executable(rom,target);
  push('vectors',{name,address,romOffset:lo,target,valid,confidence:valid?0.95:0,evidence:'hardware-vector',reason:valid?'mapped-target':'invalid-or-reserved-target'});
 }
 // Knowledge data has explicit SNES inclusive bounds, not physical offsets.
 // Bound total work even if external regions overlap across many aliases.
 let dataBudget=0x1000000;inv.metrics.knowledgeDataBytesVisited=0;inv.metrics.knowledgeDataBudgetExhausted=false;
 for(const r of options.dataRegions||[]){if(!r||!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.end<r.start||r.end>0xffffff)throw new Error('Invalid RIE data region');
  if(inv.inputs.dataRegions.length>=cap){inv.metrics.knowledgeDataBudgetExhausted=true;break;}
  inv.inputs.dataRegions.push({start:r.start,end:r.end,source:String(r.source||'knowledge')});
  for(let a=r.start;a<=r.end;a++){if(dataBudget--<=0){inv.metrics.knowledgeDataBudgetExhausted=true;break;}const off=at(a);if(off!==null&&labels[off]!==4)mark(off,3);inv.metrics.knowledgeDataBytesVisited++;}
  if(inv.metrics.knowledgeDataBudgetExhausted)break;
 }
 if(analysis&&analysis.romFingerprint&&analysis.romFingerprint!==services.hash)throw new Error('RIE analysis ROM identity mismatch');
 const refs=new Set(),indirect=new Set();
 for(const f of analysis&&analysis.functions||[]){
  push('functions',{address:f.start,state:{...f.entryState},stateSig:f.functionKey||f.entryStateSig,evidence:'existing-cfg',confidence:0.8});
  for(const i of f.instructions||[]){
   // Instruction operands wrap PC inside PB, matching decodeOne's fetch.
   for(let n=0;n<i.size;n++){const off=at((i.pc&0xff0000)|((i.pc+n)&65535));if(off===null)continue;identified[off]=1;if(i.status==='native')translated[off]=1;if(labels[off]===3||labels[off]===4||labels[off]===5)labels[off]=5;else labels[off]=2;}
   if(['JMP','JML','JSR','JSL','RTS','RTL'].includes(i.mnemonic)&&(i.indirectTargets||i.indirectResolution||/Indirect/.test(i.mode))){const key=i.pc+'|'+(i.stateSig||'');if(!indirect.has(key)){indirect.add(key);push('indirectSites',{address:i.pc,stateSig:i.stateSig,mode:i.mode,targets:(i.indirectTargets||[]).slice(0,cap),targetCount:(i.indirectTargets||[]).length,targetsTruncated:Math.max(0,(i.indirectTargets||[]).length-cap),evidence:i.indirectResolution?'existing-cfg-resolution':'existing-cfg-candidates',resolution:i.indirectResolution||null,domainProven:!!(i.indirectResolution&&i.indirectResolution.index_bounds_proven===true)});}}
  }
  for(const c of f.calls||[]){const key=c.from+'|'+c.target+'|'+c.kind+'|'+(c.stateSig||'');if(refs.has(key))continue;refs.add(key);push('references',{from:c.from,target:c.target,kind:c.kind,stateSig:c.stateSig,interbank:(c.from>>>16)!==(c.target>>>16),evidence:'existing-cfg'});}
 }
 // Calls alone do not include direct JML/JMP/branch edges. Reuse the
 // existing CFG edges too; do not infer new execution paths here.
 const callPairs=new Set();for(const f of analysis&&analysis.functions||[])for(const c of f.calls||[])callPairs.add(c.from+'|'+c.target);
 for(const f of analysis&&analysis.functions||[])for(const e of f.edges||[]){
  if(e.type==='fallthrough'||!Number.isInteger(e.to)||callPairs.has(e.from+'|'+e.to))continue;
  const key=e.from+'|'+e.to+'|'+e.type+'|'+(e.fromState||'');if(refs.has(key))continue;refs.add(key);
  push('references',{from:e.from,target:e.to,kind:e.type,stateSig:e.fromState,toStateSig:e.toState,interbank:(e.from>>>16)!==(e.to>>>16),evidence:'existing-cfg-edge'});
 }
 // Compact physical partition. Counts stay exact even when output is capped.
 let run=0;const addRegion=end=>{const id=labels[run],r={start:run,end,classification:CLASS[id],evidence:EVIDENCE[id],confidence:CONFIDENCE[id]};if(inv.regions.length<regionCap)inv.regions.push(r);else truncated.regions++;run=end;};
 for(let p=0;p<size;p++){counts[CLASS[labels[p]]]++;inv.metrics.identifiedCodeBytes+=identified[p];inv.metrics.translatableBytes+=translated[p];if(labels[p]===5)inv.metrics.conflictBytes++;if(p&&labels[p]!==labels[p-1])addRegion(p);}
 if(size)addRegion(size);
 if(inv.metrics.conflictBytes)inv.notes.push('Code/data conflicts remain unknown and do not change the existing CFG or emitter.');
 return inv;
}
function markdown(i){const m=i.metrics,c=i.classificationBytes;return [
 '# Forja65 ROM Intelligence — Inventory',
 '',`ROM: ${i.rom.title} (${i.rom.fnv1a64})`, `Mapping: ${i.mapping.kind}; scope: ${i.mapping.scope}`,'',
 '| Medida | Bytes |','|---|---:|',`| ROM inventariada | ${m.inventoriedBytes} |`,`| Bytes físicos com janela no mapper base | ${m.mappedPhysicalBytes} |`,`| Código identificado pelo CFG (união física) | ${m.identifiedCodeBytes} |`,`| Código provável sem conflito | ${c.probableCode} |`,`| Código confirmado por execução | ${c.confirmedCode} |`,`| Instruções com emissor disponível (bytes) | ${m.translatableBytes} |`,`| Dados classificados | ${c.data} |`,`| Desconhecido (inclui conflitos) | ${c.unknown} |`,`| Conflitos código/dados | ${m.conflictBytes} |`,`| Código recompilado e validado nesta análise | ${m.compiledValidatedBytes} |`,`| Código validado em execução | ${m.executionValidatedBytes} |`,'',
 `Bancos com janelas: ${i.banks.length}; páginas examinadas/reutilizadas: ${m.pagesScanned}/${m.pagesReused}; funções/variantes registradas: ${i.functions.length}.`,
 `Cache: ${i.cache.status}; bytes lidos para estatísticas nesta chamada: ${m.physicalBytesScanned}.`,
 `Listas truncadas: ${JSON.stringify(i.truncated)}. Orçamento de dados esgotado: ${m.knowledgeDataBudgetExhausted}.`,'',...i.notes.map(n=>'- '+n),''
 ].join('\n');}
return {SCHEMA,REVISION,build,markdown,busOffset};
});
