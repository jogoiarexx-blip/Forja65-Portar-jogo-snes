'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const A=require('../tools/cfg-evidence-audit-v043688');
const ROOT=fs.mkdtempSync(path.join(os.tmpdir(),'forja89-mixed-rom-'));
const romA='1111111111111111',romB='2222222222222222';
let checks=0;
function check(cond,msg){assert(cond,msg);checks++;}
function put(dir,filename,content){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,filename),content);}
function hint(hash,from='008000',target='008040'){
  return `rom=${hash} from=${from} target=${target} kind=FLOW e=1 m=1 x=1 c=0\n`;
}
try{
  const mixed=path.join(ROOT,'mixed');
  put(mixed,'forja65-unresolved-targets.txt','008000 -> 008040\n');
  put(mixed,'forja65-runtime-hints.txt',hint(romA)+hint(romB));
  for(const filter of ['',romA,romB]){
    const result=A.audit(A.collectFiles([mixed]),filter?{romHash:filter}:{});
    check(result.totals.ambiguous_multi_rom_events===1,'ambiguous event counted '+filter);
    check(result.totals.corroborated_flows===0,'ambiguous raw event cannot prove ROM '+filter);
    check(result.sites.length===1&&!result.sites[0].corroborated,'site not corroborated '+filter);
  }
  const single=path.join(ROOT,'single');
  put(single,'forja65-unresolved-targets.txt','008000 -> 008040\n');
  put(single,'forja65-runtime-hints.txt',hint(romA)+hint(romA));
  const valid=A.audit(A.collectFiles([single]),{romHash:romA});
  check(valid.totals.corroborated_flows===1,'single ROM event valid');
  check(valid.totals.ambiguous_multi_rom_events===0,'duplicate hints same ROM unambiguous');
  // Multiple ROMs in folder are safe if source/target pairs are distinct.
  const split=path.join(ROOT,'split');
  put(split,'forja65-unresolved-targets.txt','008000 -> 008040\n008100 -> 008140\n');
  put(split,'forja65-runtime-hints.txt',hint(romA)+hint(romB,'008100','008140'));
  const separate=A.audit(A.collectFiles([split]));
  check(separate.totals.corroborated_flows===2,'different addresses uniquely attributable');
  check(separate.totals.ambiguous_multi_rom_events===0,'no false ambiguous');
  check(A.renderMarkdown(A.audit(A.collectFiles([mixed]))).includes('ROM ambigua'),'report explains ambiguity');
  console.log('CFG_MIXED_ROM_EVIDENCE_V043689_PASS checks='+checks);
}finally{fs.rmSync(ROOT,{recursive:true,force:true});}
