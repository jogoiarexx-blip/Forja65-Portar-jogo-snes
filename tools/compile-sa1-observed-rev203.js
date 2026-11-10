#!/usr/bin/env node
'use strict';
// Forja 65C816 emitter specialization at observed SA-1 PCs, not opcode dispatch.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),C=require('../forja65-core');
function compile(tracePath,interpreterPath,romPath,out,options={}){
 const perFile=options.perFile||500;if(!Number.isSafeInteger(perFile)||perFile<1)throw Error('Invalid shard size');
 const cpu=options.cpu||'sa1';if(!['sa1','scpu'].includes(cpu))throw Error('Invalid CPU');
 const rom=C.loadRom(new Uint8Array(fs.readFileSync(romPath))),hash=C.romFingerprint(rom);
 if(!options.anyRom&&hash!=='450b6a34c1050e03')throw Error('This observed route belongs to Kirby USA 450b6a34c1050e03');
 const text=fs.readFileSync(interpreterPath,'utf8'),ops=new Map();
 const re=/static void forja65_i(\d)_([0-9a-f]{2})\(CpuState&cpu,SnesRuntime&hw,std::uint32_t ipc,std::uint32_t opL\)\{\n([\s\S]*?)\n\}/g;
 for(const m of text.matchAll(re))ops.set(m[1]+'_'+m[2],m[3]);
 if(ops.size!==1280)throw Error('Unexpected emitter table shape: '+ops.size);
 const states=new Map(),ambiguous=new Set();for(const line of fs.readFileSync(tracePath,'utf8').trim().split(/\r?\n/)){
  const v=line.split(/\s+/).map(x=>parseInt(x,16));if(v.length!==6||v.some(x=>!Number.isSafeInteger(x)))throw Error('Malformed observation');
  const [pc,state,...bytes]=v;if(pc>0xffffff||state>7||bytes.some(x=>x>255))throw Error('Invalid observation range');
  const key=pc*8+state;
  if(options.anyRom){states.set(key+':'+bytes.join(','),{pc,state,bytes,key});continue;} // WRAM: varias versoes dos bytes na mesma posicao, cada uma vira entrada propria
  if(states.has(key)&&JSON.stringify(states.get(key).bytes)!==JSON.stringify(bytes))throw Error('Self-modifying observed entry needs separate code generation');
  states.set(key,{pc,state,bytes,key});
 }
 let result='#include "generated.hpp"\n#include "forja_'+cpu+'_aot.hpp"\n#include <algorithm>\n#include <iterator>\n';const preamble=result,rows=[],bodies=[],prototypes=[];
 for(const[,item]of [...states].sort((a,b)=>a[1].key-b[1].key)){const key=item.key;
  const {pc,state,bytes}=item,e=!!(state&4),m=!!(state&2),x=!!(state&1),si=e?0:1+(m?2:0)+(x?1:0);
  const d=C.makeSyntheticRom();d.set(bytes,0);const instruction=C.decodeOne(C.loadRom(d),0x8000,{emulation:e,m8:m,x8:x,carry:null});
  const name=cpu+'_pc_'+pc.toString(16)+'_'+state+(options.anyRom?'_v'+rows.length:'');
  let body=ops.get(si+'_'+bytes[0].toString(16).padStart(2,'0'));
  if(bytes[0]===0x60||bytes[0]===0x6b){const long=bytes[0]===0x6b;
   body=`hw.traceInstruction(ipc,cpu,${bytes[0]});hw.advanceCpuInstruction(ipc,6,1,SnesRuntime::NO_TIMING_ADDR,0,SnesRuntime::NO_TIMING_ADDR,0,${long?3:2},2,false);\n`+
   `auto raw=cpu.peekStack16(hw,${long});auto bank=${long?'cpu.peekStack8(hw,3,true)':'cpu.pb'};auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&65535u);\n`+
   `if(hw.nativeReturnMatches(dst,${long},cpu))hw.popNativeReturn();else hw.retireRedirectedNativeReturn(cpu,${long});\n`+
   `cpu.dropStack(${long?3:2},${long});cpu.pb=bank;hw.requestDispatch(dst,ipc);`;
  }
  const operand=bytes[1]|(bytes[2]<<8)|(bytes[3]<<16);
  prototypes.push(`void ${name}(CpuState&,SnesRuntime&);`);
  bodies.push(`void ${name}(CpuState&cpu,SnesRuntime&hw){constexpr std::uint32_t ipc=0x${pc.toString(16)},opL=0x${operand.toString(16)};(void)opL;\n${body}\n}\n`);
  rows.push(`{${key}u,${instruction.size}u,{${bytes.join(',')}},&${name}}`);
 }
 const parts=[];for(let i=0;i<bodies.length;i+=perFile){const file=path.basename(out,'.cpp')+'_part_'+String(i/perFile).padStart(3,'0')+'.cpp';fs.writeFileSync(path.join(path.dirname(out),file),preamble+bodies.slice(i,i+perFile).join(''));parts.push(file);}
 const prefix=path.basename(out,'.cpp')+'_part_';for(const file of fs.readdirSync(path.dirname(out)))if(file.startsWith(prefix)&&/^\d{3}\.cpp$/.test(file.slice(prefix.length))&&!parts.includes(file))fs.unlinkSync(path.join(path.dirname(out),file));
 result+=prototypes.join('\n')+'\n';
 result+='struct Sa1Entry{std::uint32_t key;unsigned size;std::uint8_t bytes[4];void(*body)(CpuState&,SnesRuntime&);};\nstatic const Sa1Entry entries[]={\n'+rows.join(',\n')+'\n};\n';
 result+='static bool step(CpuState&c,SnesRuntime&h,std::uint32_t pc,const std::uint8_t b[4]){auto key=pc*8u+(c.e?4u:0u)+(c.m8?2u:0u)+(c.x8?1u:0u);auto it=std::lower_bound(std::begin(entries),std::end(entries),key,[](const Sa1Entry&e,std::uint32_t k){return e.key<k;});if(it==std::end(entries)||it->key!=key||!std::equal(b,b+it->size,it->bytes))return false;it->body(c,h);return true;}\n';
 result+=`static const bool registered=[](){forja65_${cpu}_aot={&step,"${hash}"};return true;}();\n`;
 if(cpu==='scpu')result=result.replace('const std::uint8_t b[4]){auto key','const std::uint8_t b[4],unsigned available){auto key').replace('it->key!=key||!std::equal','it->key!=key||available<it->size||!std::equal');
 if(options.anyRom)result=result.replace('if(it==std::end(entries)||it->key!=key||available<it->size||!std::equal(b,b+it->size,it->bytes))return false;it->body(c,h);return true;}','for(;it!=std::end(entries)&&it->key==key;++it){if(available<it->size||!std::equal(b,b+it->size,it->bytes))continue;it->body(c,h);return true;}return false;}');
 fs.writeFileSync(out,result);const report={cpu,parts,schema:'forja65.'+cpu+'.observed-aot.v1',rom:hash,entries:rows.length,source_sha256:crypto.createHash('sha256').update(result).digest('hex'),emitter_sha256:crypto.createHash('sha256').update(text).digest('hex'),scope:'Observed '+cpu+' CPU instructions only; unknown PCs or changed bytes fail closed; no gameplay or bus-timing certification.'};fs.writeFileSync(out+'.json',JSON.stringify(report,null,2));return report;
}
if(require.main===module){try{if(![6,7,8].includes(process.argv.length))throw Error('Usage: node compile-sa1-observed-rev203.js trace interpreter.cpp ROM.sfc out.cpp');console.log(JSON.stringify(compile(...process.argv.slice(2,6),{cpu:process.argv[6]||'sa1',anyRom:process.argv[7]==='--any-rom'}),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={compile};
