'use strict';
const C=require('../forja65-core.js');
// Static CFG may only decode ROM-backed code. RAM/IO target evidence is retained
// separately and must never be converted into a translated-ROM coverage claim.
function partitionExecutableHints(rom,hints,isRomAddress=C.isRomAddress){
  const romHints=[],nonRomHints=[];
  for(const hint of hints){
    (isRomAddress(rom,hint.target)?romHints:nonRomHints).push(hint);
  }
  return {romHints,nonRomHints};
}
module.exports={partitionExecutableHints};
