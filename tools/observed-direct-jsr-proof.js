#!/usr/bin/env node
'use strict';
// ROM-backed proof for the *site* of an observed direct same-bank JSR.
// Does not assert that a hint file was produced by actual execution.
function directJsrProof(rom,from,to,map){
 if(!rom||!rom.data||typeof map!=='function'||![from,to].every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffff))return null;
 if((from>>>16)!==(to>>>16))return null;
 // This proof reads a contiguous ROM slice. CPU fetch wraps inside PB;
 // leave crossing instructions unproved instead of reading the next file bank.
 if((from&0xffff)>0xfffd)return null;
 const off=map(rom,from);
 if(off==null||off<0||off+3>rom.data.length||rom.data[off]!==0x20)return null;
 const actual=(from&0xff0000)|rom.data[off+1]|(rom.data[off+2]<<8);
 if(actual!==to)return null;
 return {source:from.toString(16).toUpperCase().padStart(6,'0'),
  target:to.toString(16).toUpperCase().padStart(6,'0'),
  opcode:[...rom.data.slice(off,off+3)].map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')};
}
module.exports={directJsrProof};
