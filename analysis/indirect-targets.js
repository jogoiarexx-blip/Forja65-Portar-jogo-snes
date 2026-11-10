// Bounded facts over instructions supplied by the existing CFG. No code traversal.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Forja65IndirectTargets=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SCHEMA='forja65.indirect-evidence.v1',MAX_PATH=64,MAX_TARGETS=64;
const unknown=()=>({known:0,value:0}),constant=n=>({known:65535,value:n&65535});
const exact=(v,mask=65535)=>(v.known&mask)===mask?v.value&mask:null;
const assign=(old,v,mask)=>{
 const out={known:((old.known&~mask)|(v.known&mask))&65535,value:((old.value&~mask)|(v.value&mask))&65535};
 if(v.values&&(mask===65535||(old.known&65280)===65280))out.values=[...new Set(v.values.map(n=>((old.value&~mask)|(n&mask))&65535))];
 return out;
};
const narrow=(v,w)=>w===255?{known:v.known|65280,value:v.value&255,...(v.values?{values:[...new Set(v.values.map(n=>n&255))]}:{})}:{...v};
const stateValid=s=>s&&typeof s.emulation==='boolean'&&typeof s.m8==='boolean'&&typeof s.x8==='boolean'&&(s.carry===null||typeof s.carry==='boolean')&&(!s.emulation||(s.m8&&s.x8));
const stateSig=s=>[+s.emulation,+s.m8,+s.x8,s.carry===null?'?':+s.carry].join('');
function supported(i){return i&&((['JMP','JSR'].includes(i.mnemonic)&&['AbsoluteIndexedIndirectX','AbsoluteIndirect','AbsoluteIndirectLong'].includes(i.mode))||['RTS','RTL'].includes(i.mnemonic));}
function ramAddress(a){const b=a>>>16,l=a&65535;if(b===0x7e||b===0x7f)return a;if((b<=0x3f||b>=0x80&&b<=0xbf)&&l<0x2000)return 0x7e0000|l;return null;}
function enumerate(v){if(v.values)return [...v.values];const bits=[];for(let b=0;b<16;b++)if(!(v.known&(1<<b)))bits.push(b);if(bits.length>6)return null;const out=[];for(let n=0;n<(1<<bits.length);n++){let value=v.value&v.known;for(let j=0;j<bits.length;j++)if(n&(1<<j))value|=1<<bits[j];out.push(value);}return out;}
// Exact small domains survive carry-producing arithmetic and transfers.
function finiteFact(values){
 const vals=[...new Set(values.map(n=>n&65535))];
 if(!vals.length||vals.length>MAX_TARGETS)return unknown();
 let known=65535;for(const v of vals)known&=~(v^vals[0]);
 return {known:known&65535,value:vals[0]&known,values:vals};
}
function mapFact(v,mask,fn){
 const vals=enumerate(v.values?v:{known:v.known|(~mask&65535),value:v.value&mask});
 return vals?finiteFact(vals.map(n=>fn(n&mask)&mask)):unknown();
}
function resolve(input,services){
 const path=(input||[]).slice(-MAX_PATH),site=path[path.length-1];if(!supported(site))return null;
 const result={schema:SCHEMA,status:'unresolved',reason:'unknown-value',scope:'bounded-predecessor-path',index_bounds_proven:false,path_domain_proven:false,targets:[],pointerReads:[],pathLength:path.length,witness:[],source:{pc:site.pc,mnemonic:site.mnemonic,mode:site.mode,state:{...site.stateOut}}};
 if(!path.length||path.some(i=>!stateValid(i.stateIn)||!stateValid(i.stateOut)))return {...result,reason:'invalid-cpu-state'};
 let decimal=null;
 let a=unknown(),x=narrow(unknown(),path[0].stateIn.x8?255:65535),y={...x},db=unknown(),dp=unknown(),stack=[],memory=new Map(),sp=null,e=path[0].stateIn.emulation;
 const reset=()=>{decimal=null;a=unknown();x=unknown();y=unknown();db=unknown();dp=unknown();sp=null;stack=[];memory.clear();};
 const finish=()=>{if(e&&sp!==null)sp=0x100|(sp&255);};
 const push=(v,full=false)=>{memory.clear();const at=sp===null?null:(full||!e?sp:0x100|(sp&255));if(at===null||ramAddress(at)===null)stack=[];else{stack.push({known:v.known&255,value:v.value&255,at});if(stack.length>32)stack.shift();}if(sp!==null)sp=full||!e?(sp-1)&65535:0x100|((sp-1)&255);};
 const pop=(full=false)=>{if(sp!==null)sp=full||!e?(sp+1)&65535:0x100|((sp+1)&255);const v=stack.length?stack.pop():unknown();if(sp===null||ramAddress(sp)===null||v.at!==sp){stack=[];return unknown();}return v;};
 const word=(full=false,finishAfter=true)=>{const lo=pop(full),hi=pop(full);if(finishAfter)finish();return {known:(lo.known&255)|((hi.known&255)<<8),value:(lo.value&255)|((hi.value&255)<<8)};};
 const pushWord=(v,full=false)=>{if(e&&sp===null&&full){memory.clear();stack=[];return;}push({known:v.known>>>8,value:v.value>>>8},full);push(v,full);finish();};
 const read=addr=>{const ram=ramAddress(addr);if(ram!==null)return memory.has(ram)?memory.get(ram):null;const off=services.bus(addr);return off===null?null:services.rom.data[off];};
 const address=i=>{let at=null;if(i.mode==='AbsoluteLong')at=i.operand&0xffffff;else if(i.mode==='Absolute'&&exact(db,255)!==null)at=(exact(db,255)<<16)|(i.operand&65535);else if(i.mode==='Direct'&&exact(dp)!==null)at=(exact(dp)+(i.operand&255))&65535;return at;};
 const load=(i,mask)=>{if(i.mode==='ImmA'||i.mode==='ImmX')return constant(i.operand);const at=address(i);if(at===null||(mask===65535&&(at&65535)===65535))return unknown();const lo=read(at),hi=mask===65535?read(at+1):0;return {known:(lo===null?0:255)|(hi===null?0:65280),value:(lo||0)|((hi||0)<<8)};};
 const store=(i,v,mask)=>{const at=address(i);stack=[];if(at===null||(mask===65535&&(at&65535)===65535)){memory.clear();return;}for(let n=0;n<(mask===255?1:2);n++){const ram=ramAddress(at+n);if(ram===null){memory.clear();return;}const bits=255<<(n*8);if((v.known&bits)===bits)memory.set(ram,(v.value>>>(n*8))&255);else memory.delete(ram);}};
 for(const i of path.slice(0,-1)){
  e=i.stateIn.emulation;const m=i.mnemonic,am=i.stateIn.m8?255:65535,xm=i.stateIn.x8?255:65535;
  if(m==='CLD')decimal=false;else if(m==='SED')decimal=true;
  else if(m==='LDA')a=assign(a,load(i,am),am);
  else if(m==='LDX')x=narrow(load(i,xm),xm);
  else if(m==='LDY')y=narrow(load(i,xm),xm);
  else if(['STA','STX','STY','STZ'].includes(m))store(i,m==='STA'?a:m==='STX'?x:m==='STY'?y:constant(0),m==='STX'||m==='STY'?xm:am);
  else if(m==='TAX')x=narrow(a,xm);else if(m==='TAY')y=narrow(a,xm);
  else if(m==='TXA')a=assign(a,x,am);else if(m==='TYA')a=assign(a,y,am);
  else if(m==='TXY')y=narrow(x,xm);else if(m==='TYX')x=narrow(y,xm);
  else if(m==='TCD')dp={...a};else if(m==='TDC')a={...dp};
  else if(m==='XBA')a={known:((a.known<<8)|(a.known>>>8))&65535,value:((a.value<<8)|(a.value>>>8))&65535};
  else if(['AND','ORA','EOR'].includes(m)&&i.mode==='ImmA'){
   const op=i.operand&am,v={known:a.known&am,value:a.value&am};
   if(m==='AND'){v.known|=(~op)&am;v.value&=op;}else if(m==='ORA'){v.known|=op;v.value|=op;}else v.value^=op;
   if(a.values){const mapped=mapFact(a,am,n=>m==='AND'?n&op:m==='ORA'?n|op:n^op);a=assign(a,mapped,am);}else a=assign(a,v,am);
  }else if(['ASL','LSR'].includes(m)&&i.mode==='Accumulator'){
   const v=m==='ASL'?{known:((a.known<<1)|1)&am,value:(a.value<<1)&am}:{known:((a.known&am)>>>1)|((am+1)>>>1),value:(a.value&am)>>>1};a=assign(a,a.values?mapFact(a,am,n=>m==='ASL'?n<<1:n>>>1):v,am);
  }else if(['INC','DEC'].includes(m)&&i.mode==='Accumulator'){const v=exact(a,am);a=assign(a,a.values?mapFact(a,am,n=>n+(m==='INC'?1:-1)):v===null?unknown():constant(v+(m==='INC'?1:-1)),am);}
  else if(['INX','DEX','INY','DEY'].includes(m)){const reg=m.endsWith('X')?x:y,v=exact(reg,xm),next=narrow(v===null?unknown():constant(v+(m.startsWith('IN')?1:-1)),xm);if(m.endsWith('X'))x=next;else y=next;}
  else if(['ADC','SBC'].includes(m)&&i.mode==='ImmA'){
   const carry=i.stateIn.carry;
   const fact=decimal===false&&typeof carry==='boolean'?mapFact(a,am,n=>m==='ADC'?n+(i.operand&am)+(carry?1:0):n-(i.operand&am)-(carry?0:1)):unknown();
   a=assign(a,fact,am);
  }
  else if(['ADC','SBC','AND','ORA','EOR','ROL','ROR'].includes(m)&&!(['ROL','ROR'].includes(m)&&i.mode!=='Accumulator'))a=assign(a,unknown(),am);
  else if(m==='PEA')pushWord(constant(i.operand),true);
  else if(m==='PHK')push(constant(i.pc>>>16));else if(m==='PHB')push(db);else if(m==='PHD')pushWord(dp,true);else if(m==='PHP')push(unknown());
  else if(['PHA','PHX','PHY'].includes(m)){const v=m==='PHA'?a:m==='PHX'?x:y,w=m==='PHA'?am:xm;if(w===65535)pushWord(v);else push(v);}
  else if(m==='PLB'){db=pop(true);finish();}else if(m==='PLD')dp=word(true);else if(m==='PLP'){pop();decimal=null;}
  else if(['PLA','PLX','PLY'].includes(m)){const w=m==='PLA'?am:xm,v=w===255?pop():word();if(m==='PLA')a=assign(a,v,am);else if(m==='PLX')x=narrow(v,xm);else y=narrow(v,xm);}
  else if(['TXS','TCS'].includes(m)){sp=exact(m==='TXS'?x:a);finish();stack=[];memory.clear();}
  else if(['NOP','CLC','SEC','CLD','SED','CLI','SEI','CLV','REP','SEP','CMP','CPX','CPY','BIT','BRA','BRL','BEQ','BNE','BCC','BCS','BMI','BPL','BVC','BVS'].includes(m)){}
  else reset(); // Calls, unmodelled memory effects and transfers invalidate facts.
  if(m==='REP'&&(i.operand&8))decimal=false;
  if(m==='SEP'&&(i.operand&8))decimal=true;
  if(i.stateOut.x8){x=narrow(x,255);y=narrow(y,255);}
 }
 e=site.stateIn.emulation;if(site.mnemonic==='JSR')memory.clear(); // Real indexed JSR pushes before reading the pointer; SP may alias any RAM byte.
 const values=[];
 const pointer=(addr,size,bankWrap)=>{let value=0;for(let n=0;n<size;n++){const at=bankWrap?((addr&0xff0000)|((addr+n)&65535)):((addr+n)&0xffffff),v=read(at);result.pointerReads.push({address:at,value:v});if(v===null)return null;value|=v<<(8*n);}return value;};
 if(['RTS','RTL'].includes(site.mnemonic)){
  const low=exact(word(site.mnemonic==='RTL',false));if(low===null)return {...result,reason:'unknown-return-stack'};
  const bank=site.mnemonic==='RTL'?exact(pop(true),255):site.pc>>>16;if(bank===null)return {...result,reason:'unknown-return-bank'};values.push((bank<<16)|((low+1)&65535));
 }else if(site.mode==='AbsoluteIndexedIndirectX'){
  const indices=enumerate(narrow(x,site.stateIn.x8?255:65535));if(!indices)return {...result,reason:'index-domain-exceeds-budget'};
  for(const index of indices){const p=(site.pc&0xff0000)|((site.operand+index)&65535),low=pointer(p,2,true);if(low===null)return {...result,reason:'unmapped-or-unknown-pointer'};values.push((site.pc&0xff0000)|low);}
 }else{
  const long=site.mode==='AbsoluteIndirectLong';if(long&&site.operand>0xfffd)return {...result,reason:'long-pointer-boundary-not-modelled'};
  const value=pointer(site.operand&65535,long?3:2,!long);if(value===null)return {...result,reason:'unmapped-or-unknown-pointer'};values.push(long?value:(site.pc&0xff0000)|value);
 }
 result.path_domain_proven=true;
 result.targets=[...new Set(values)].filter(t=>services.bus(t)!==null&&services.executable(t)&&(!services.inData||!services.inData(t))).sort((a,b)=>a-b);
 if(result.targets.length)result.witness=path.map(i=>({pc:i.pc,raw:Array.from(i.raw||[]),state:{...i.stateIn}}));
 result.status=result.targets.length?'resolved':'unresolved';result.reason=result.targets.length===new Set(values).size?'bounded-path-values':result.targets.length?'partial-invalid-or-data-target':'invalid-or-data-target';
 return result;
}
function replay(witness,services){
 const fail=reason=>({schema:SCHEMA,status:'unresolved',reason,targets:[],witness:[]});
 if(!Array.isArray(witness)||!witness.length||witness.length>MAX_PATH)return fail('invalid-witness-size');
 const path=[];
 for(const r of witness){
  if(!r||!Number.isSafeInteger(r.pc)||r.pc<0||r.pc>0xffffff||!stateValid(r.state)||!Array.isArray(r.raw)||r.raw.length<1||r.raw.length>4||r.raw.some(b=>!Number.isInteger(b)||b<0||b>255))return fail('invalid-witness-record');
  for(let n=0;n<r.raw.length;n++){const off=services.bus((r.pc&0xff0000)|((r.pc+n)&65535));if(off===null||services.rom.data[off]!==r.raw[n])return fail('witness-rom-bytes-mismatch');}
  let fresh;try{fresh=services.decodeSource(r.pc,r.state);}catch(_){return fail('witness-decode-failed');}
  if(fresh.size!==r.raw.length||fresh.raw.some((b,n)=>b!==r.raw[n]))return fail('witness-instruction-size-mismatch');
  const prev=path[path.length-1];if(prev){
   const unconditional=['BRA','BRL'].includes(prev.mnemonic);
   const fall=(prev.pc&0xff0000)|((prev.pc+prev.size)&65535),branch=['BRA','BRL','BEQ','BNE','BCC','BCS','BMI','BPL','BVC','BVS'].includes(prev.mnemonic),jump=['JMP','JML'].includes(prev.mnemonic)&&['Absolute','AbsoluteLong'].includes(prev.mode);
   if((prev.mnemonic==='JMP'&&!jump)||['RTS','RTL','RTI','STP'].includes(prev.mnemonic)||(r.pc!==fall&&!(branch||jump))||(r.pc!==fall&&r.pc!==prev.flowTarget)||((jump||unconditional)&&r.pc!==prev.flowTarget))return fail('disconnected-witness');
   if(stateSig(prev.stateOut)!==stateSig(r.state))return fail('witness-state-transition-mismatch');
  }
  path.push(fresh);
 }
 return resolve(path,services)||fail('unsupported-witness-source');
}
function report(a,services){
 const sites=[],seen=new Set();let total=0,resolved=0,unresolved=0,revalidated=0;
 for(const f of a.functions||[])for(const i of f.instructions||[]){const r=i.rieIndirect;if(!r)continue;const key=i.pc+'|'+stateSig(i.stateIn)+'|'+JSON.stringify(r.witness||[]);if(seen.has(key))continue;seen.add(key);total++;if(r.targets.length)resolved++;else unresolved++;let proof=null;if(r.targets.length){proof=replay(r.witness,services);if(proof&&proof.targets.length)revalidated++;}
  if(sites.length<1024)sites.push({address:i.pc,state:{...i.stateIn},mnemonic:i.mnemonic,mode:i.mode,status:r.status,reason:r.reason,targets:r.targets,pathLength:r.pathLength,pointerReads:r.pointerReads,index_bounds_proven:false,revalidation:proof?{status:proof.status,reason:proof.reason,targets:proof.targets}:null});
 }
 return {schema:SCHEMA,scope:'bounded-path-evidence-not-gameplay',limits:{maxPath:MAX_PATH,maxTargets:MAX_TARGETS,maxReportedSites:1024},totalSites:total,resolvedPathSites:resolved,unresolvedSites:unresolved,revalidatedSites:revalidated,truncatedSites:Math.max(0,total-sites.length),executionValidatedSites:0,sites};
}
return {SCHEMA,MAX_PATH,MAX_TARGETS,supported,resolve,replay,report,stateValid,stateSig};
});
