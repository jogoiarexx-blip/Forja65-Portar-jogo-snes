#!/usr/bin/env node
'use strict';
// REV174 R10: restrict a learned SEP/REP entry to its one proven instruction.
// The rest of the routine is dispatched through already-certified AOT entries.
const fs = require('fs'), path = require('path');
const core = require('../forja65-core.js');
const hex = n => (n & 0xffffff).toString(16).toUpperCase().padStart(6,'0');
function stateOf(s) {
  const m = /^M([01])X([01])$/.exec(s);
  if (!m) throw Error('State must be M0X0, M0X1, M1X0 or M1X1 (E0 only)');
  return {e:false,m:!!Number(m[1]),x:!!Number(m[2])};
}
function restrict({romBytes, shardText, dispatchText, pc, state}) {
  if(!Number.isInteger(pc) || pc<0 || pc>0xffffff) throw Error('Invalid PC');
  const flags = stateOf(state);
  const rom = core.loadRom(new Uint8Array(romBytes),'rom.sfc');
  const offset = core.snesToRom(rom,pc);
  if(offset==null || offset+1>=rom.data.length) throw Error('PC outside ROM');
  const opcode=rom.data[offset], operand=rom.data[offset+1];
  if(opcode!==0xe2 && opcode!==0xc2) throw Error('Only deterministic SEP/REP immediate entries are allowed');
  const mnemonic=opcode===0xe2?'SEP':'REP';
  const next=(pc&0xff0000)|((pc+2)&0xffff);
  const after={...flags};
  if(opcode===0xe2) {if(operand&0x20)after.m=true;if(operand&0x10)after.x=true;}
  else {if(operand&0x20)after.m=false;if(operand&0x10)after.x=false;}
  const wanted=`{0x${hex(next)}u,${after.e},${after.m},${after.x},`;
  if(!dispatchText.includes(wanted))throw Error('Next instruction lacks exact-state AOT dispatch: '+hex(next)+' '+state);
  const label='L_'+hex(pc)+':', end='L_'+hex(next)+':';
  const at=shardText.indexOf('\n'+label+'\n');
  if(at<0 || shardText.indexOf('\n'+label+'\n',at+1)>=0)throw Error('Missing or ambiguous entry label');
  const endAt=shardText.indexOf('\n'+end+'\n',at+1);
  if(endAt<0)throw Error('Entry successor label missing');
  const body=shardText.slice(at,endAt);
  if(!body.includes(`// $${hex(pc)} ${mnemonic}`) || !body.includes(`cpu.${mnemonic.toLowerCase()}(0x${operand.toString(16).toUpperCase()}u);`) &&
     !body.toLowerCase().includes(`cpu.${mnemonic.toLowerCase()}(0x${operand.toString(16)}u);`))
    throw Error('Generated body differs from ROM SEP/REP opcode');
  if(!body.includes('hw.advanceCpuInstruction('))throw Error('Missing CPU timing');
  const branch=`goto L_${hex(next)};`, count=body.split(branch).length-1;
  const replacement=`hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x${(next&0xffff).toString(16).toUpperCase().padStart(4,'0')}u, 0x${hex(pc)}u); return;`;
  if(count===0 && body.includes(replacement))return {text:shardText,changed:false,branches:0,next:hex(next),opcode:mnemonic};
  if(count<1 || count>4)throw Error('Expected 1-4 direct transitions from the learned instruction');
  if((body.match(/\/\/ \$[0-9A-F]{6} [A-Z]{3}/g)||[]).some(x=>x!==`// $${hex(pc)} ${mnemonic}`))
    throw Error('Entry span contains an unexpected opcode');
  const updatedBody=body.split(branch).join(replacement);
  const updated=shardText.slice(0,at)+updatedBody+shardText.slice(endAt);
  return {text:updated,changed:true,branches:count,next:hex(next),opcode:mnemonic};
}
function main(argv) {
  const options={};
  for(let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if(arg==='--apply')options.apply=true;
    else if(['--rom','--shard','--dispatch','--pc','--state'].includes(arg))options[arg.slice(2)]=argv[++i];
    else throw Error('Unexpected argument: '+arg);
  }
  for(const required of ['rom','shard','dispatch','pc','state'])if(!options[required])throw Error('Missing --'+required);
  if(!/^[0-9a-fA-F]{6}$/.test(options.pc))throw Error('PC must be six hex digits');
  const p=path.resolve(options.shard);
  if(fs.lstatSync(p).isSymbolicLink())throw Error('Symlink refused');
  const ret=restrict({romBytes:fs.readFileSync(options.rom),shardText:fs.readFileSync(p,'utf8'),
    dispatchText:fs.readFileSync(options.dispatch,'utf8'),pc:parseInt(options.pc,16),state:options.state});
  if(ret.changed&&options.apply) {
    const temp=p+'.r10-stage-'+process.pid;
    try{fs.writeFileSync(temp,ret.text,{flag:'wx'});fs.renameSync(temp,p);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  }
  console.log(JSON.stringify({status:'PASS',changed:ret.changed,applied:!!(ret.changed&&options.apply),
    branches:ret.branches,pc:options.pc,next:ret.next,opcode:ret.opcode}));
}
if(require.main===module)try{main(process.argv.slice(2));}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}
module.exports={restrict};
