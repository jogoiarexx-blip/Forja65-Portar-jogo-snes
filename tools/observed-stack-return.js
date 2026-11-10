'use strict';
// An observed native-stack mismatch is evidence of a possible computed return,
// not permission to bypass the C++ return stack. ROM and runtime evidence must
// agree before seeding a new STACK-RTS/STACK-RTL dispatcher target.
const C=require('../forja65-core');
function verifyObservedStackReturns(rom,hints,unresolvedReturnLog){
 const records=new Set();
 for(const row of String(unresolvedReturnLog||'').split(/\r?\n/)){
  const m=row.match(/^\s*([0-9a-f]+)\s*->\s*([0-9a-f]+)\s+kind=(STACK-(?:RTS|RTL))\b/i);
  if(m)records.add([parseInt(m[1],16),parseInt(m[2],16),m[3].toUpperCase()].join('|'));
 }
 let verified=0;
 for(const h of hints){
  const kind=String(h.kind||'').toUpperCase();
  if(kind!=='STACK-RTS'&&kind!=='STACK-RTL')continue;
  const from=h.from,target=h.target;
  if(from===null||from===undefined)throw new Error('STACK return observation without source PC');
  const sourceOffset=C.snesToRom(rom,from),targetOffset=C.snesToRom(rom,target);
  const expected=kind==='STACK-RTL'?0x6B:0x60;
  if(sourceOffset===null||rom.data[sourceOffset]!==expected)throw new Error(kind+' source $'+C.hex(from,6)+' is not '+(kind==='STACK-RTL'?'RTL':'RTS')+' in this ROM');
  if(targetOffset===null)throw new Error(kind+' target $'+C.hex(target,6)+' is outside the ROM');
  if(!records.has([from,target,kind].join('|')))throw new Error(kind+' $'+C.hex(from,6)+' -> $'+C.hex(target,6)+' lacks exact runtime return evidence');
  verified++;
 }
 return verified;
}
module.exports={verifyObservedStackReturns};
