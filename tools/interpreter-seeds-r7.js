#!/usr/bin/env node
'use strict';
/**
 * REV174 R7: turn observed 65C816 interpreter entry points into ROM-bound
 * candidate CFG seeds. This does NOT recompile code or mark it native.
 * Entrypoint state is known from CPU at the dispatch boundary; carry is
 * deliberately unknown because the old report did not record it.
 */
const fs=require('node:fs');
const path=require('node:path');
function fail(message){throw new Error(message);}
function romFingerprint(bytes){
  let h=1469598103934665603n;
  for(const b of bytes){h=BigInt.asUintN(64,(h^BigInt(b))*1099511628211n);}
  return h.toString(16).padStart(16,'0');
}
function readRom(file){
  const raw=fs.readFileSync(file);
  const header=raw.length%1024===512?512:0;
  if(raw.length-header<32768 || (raw.length-header)%32768!==0)fail('Invalid ROM layout/size');
  const data=raw.subarray(header);
  return {data,hash:romFingerprint(data),header};
}
function isRomAddress(a,romBytes){
  const bank=(a>>>16)&255,off=a&65535;
  if(bank===0x7e||bank===0x7f)return false;
  // LoROM CPU mapping (the SMW port is LoROM). Never treat low-bank MMIO/WRAM as ROM.
  if(off<0x8000 && (bank&0x7f)<0x40)return false;
  const pos=(((bank&0x7f)<<15)|(off&0x7fff)) % romBytes;
  return pos>=0&&pos<romBytes;
}
const hex=(n)=>n.toString(16).toUpperCase().padStart(6,'0');
function parseReport(txt,rom,opts={}){
  const lines=txt.split(/\r?\n/),index=lines.findIndex(x=>x.trim()==='# entrada estado(E/M/X) origem execucoes');
  if(!lines[0].trim().startsWith('FORJA65_CPU_INTERPRETER 1')||index<0)fail('Unsupported interpreter report schema');
  const blocksLine=lines.find(x=>/^blocks=\d+$/.test(x));
  const sourceHashLine=lines.find(x=>/^rom=[0-9a-fA-F]{16}$/.test(x));
  const sourceHash=sourceHashLine?.slice(4).toLowerCase()||null;
  if(sourceHash && sourceHash!==rom.hash)fail('Interpreter report ROM hash does not match the provided ROM');
  if(!sourceHash && !opts.auditHash)fail('Legacy report has no ROM hash: provide a matching native dependency audit');
  if(opts.auditHash && opts.auditHash!==rom.hash)fail('Native dependency audit ROM hash mismatch');
  const entry=new Map(),rejected=[];
  for(let i=index+1;i<lines.length;i++){
    const line=lines[i].trim();if(!line||line.startsWith('#'))continue;
    // Accept only exact entries, not arbitrary injected hints.
    const m=/^([0-9A-Fa-f]{6}) (E1|M0X0|M0X1|M1X0|M1X1) from=([0-9A-Fa-f]{6}) count=(\d{1,18})$/.exec(line);
    if(!m){rejected.push({line:i+1,reason:'malformed-entry'});continue;}
    const pc=parseInt(m[1],16),from=parseInt(m[3],16),state=m[2],count=Number(m[4]);
    if(!Number.isSafeInteger(count)||count<1){rejected.push({line:i+1,reason:'invalid-count'});continue;}
    if(!isRomAddress(pc,rom.data.length)){rejected.push({line:i+1,reason:'not-ROM'});continue;}
    if(!isRomAddress(from,rom.data.length)){rejected.push({line:i+1,reason:'origin-not-ROM'});continue;}
    const e=Number(state==='E1'),mWidth=e?1:Number(state[1]),xWidth=e?1:Number(state[3]);
    const key=[pc,from,e,mWidth,xWidth].join(':');
    const prev=entry.get(key);
    if(prev)prev.count=Math.min(1000000,prev.count+count);
    else entry.set(key,{pc,from,e,m:mWidth,x:xWidth,count:Math.min(1000000,count)});
  }
  const candidates=[...entry.values()].sort((a,b)=>b.count-a.count||a.pc-b.pc||a.from-b.from);
  const limit=opts.limit??512;
  if(!Number.isSafeInteger(limit)||limit<1||limit>5000)fail('Max candidates must be 1..5000');
  const selected=candidates.slice(0,limit);
  const hints=selected.map(r=>`rom=${rom.hash} target=${hex(r.pc)} from=${hex(r.from)} kind=INTERPRETER e=${r.e} m=${r.m} x=${r.x} c=? observed=${r.count}`).join('\n')+'\n';
  return {hints,report:{schema:'forja65.interpreter-seeds.r7',rom:rom.hash,source_blocks:blocksLine?Number(blocksLine.slice(7)):null,original_entries:candidates.length,selected_entries:selected.length,rejected,observed_dispatch_count:selected.reduce((s,e)=>s+e.count,0),note:'Seeds are runtime observations, not AOT coverage or proof of control-flow closure.'},selected};
}
function run(args){
  const get=n=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:null;};
  const file=get('report'),romFile=get('rom'),out=get('out'),json=get('json');
  if(!file||!romFile||!out)fail('Usage: interpreter-seeds-r7.js --rom assets/cart-data.bin --report forja65-cpu-interpreter.txt --out analysis/r7-candidates.txt [--json reports/r7.json] [--audit forja65-native-dependency-report.txt] [--max 512]');
  const rom=readRom(romFile),source=fs.readFileSync(file,'utf8');
  const auditPath=get('audit')||path.join(path.dirname(path.resolve(file)),'forja65-native-dependency-report.txt');
  let auditHash=null;
  if(fs.existsSync(auditPath)){
    const audit=fs.readFileSync(auditPath,'utf8');
    if(!audit.startsWith('FORJA65_NATIVE_DEPENDENCY_AUDIT 1'))fail('Invalid native dependency audit format');
    auditHash=/^rom=([a-fA-F0-9]{16})$/m.exec(audit)?.[1]?.toLowerCase()||null;
    if(!auditHash)fail('Native dependency audit has no ROM hash');
  }
  const result=parseReport(source,rom,{limit:get('max')?Number(get('max')):512,auditHash});
  if(!result.selected.length)fail('No ROM-bound interpreter entries; refusing to write an empty/invalid hint set');
  // Round-trip through the canonical Forja parser when running within a Forja installation.
  const possibleCore=path.resolve(__dirname,'../forja65-core.js');
  if(fs.existsSync(possibleCore)){
    const c=require(possibleCore),parsed=c.parseRuntimeHintsDetailed(result.hints);
    if(parsed.rejected.length||parsed.hints.length!==result.selected.length)fail('Forja core rejected candidate hints');
    const loaded=c.loadRom(new Uint8Array(fs.readFileSync(romFile)),path.basename(romFile));
    if(c.romFingerprint(loaded)!==rom.hash)fail('ROM fingerprint differs from Forja core');
  }
  fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,result.hints);
  if(json){fs.mkdirSync(path.dirname(path.resolve(json)),{recursive:true});fs.writeFileSync(json,JSON.stringify(result.report,null,2)+'\n');}
  process.stdout.write(JSON.stringify(result.report,null,2)+'\n');return result;
}
if(require.main===module){try{run(process.argv.slice(2));}catch(e){console.error('R7 interpreter seeds: '+e.message);process.exitCode=2;}}
module.exports={parseReport,readRom,romFingerprint,run,isRomAddress};
