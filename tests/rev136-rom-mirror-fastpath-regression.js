'use strict';
// CPU/runtime optimization regression: binary-sized LoROM/HiROM mirrors must
// retain the exact bsnes-style mapping. Non-power-of-two ROMs use legacy algorithm.
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
function legacy(size,off){
 if(size<=0)return null;
 if(off<size)return off;
 let mask=0x80000000;
 while(mask&&!(off&mask))mask>>>=1;
 if(!mask)return 0;
 if(size<=(off&mask))return legacy(size,off-mask);
 return mask+legacy(size-mask,off-mask);
}
let tests=0;
const rom=F.loadRom(F.makeSyntheticRom(),'rev136.sfc');
for(const size of [1,2,3,7,8,31,32,65536,131072,262144,524288,786432,1048576,1572864,4194304]){
 rom.data=new Uint8Array(size);
 // REV194: o contrato padrao segue o bsnes boards.bml (LoROM sem espelho em $40-7D/$C0-FF:0000-7FFF, ExHiROM
 // com $80-FF na metade baixa, ExLoROM novo); o perfil 'legacy' continua com as formulas da REV136.
 for(const profile of ['rev194','legacy'])for(const mapping of [F.MAP.LOROM,F.MAP.HIROM,F.MAP.EXHIROM,...(profile==='legacy'?[]:[F.MAP.EXLOROM])]){
  rom.header.mapping=mapping;rom.header.mappingProfile=profile;rom.header.board=null;
  for(let bank=0;bank<=255;bank+=3){
   for(const addr of [0,0x1111,0x6000,0x7FFF,0x8000,0xBEEF,0xFFFF]){
    const full=bank>=0x40&&bank<=0x7D||bank>=0xC0;
    let off=null;
    if(bank!==0x7E&&bank!==0x7F){
     if(profile==='legacy'){
      if(mapping===F.MAP.LOROM){if(addr>=0x8000||full)off=((bank&127)<<15)|(addr&32767);}
      if(mapping===F.MAP.HIROM){if(addr>=0x8000||full)off=((bank&63)<<16)|addr;}
      if(mapping===F.MAP.EXHIROM){if(addr>=0x8000||full)off=(((bank&127)<<16)|addr)+((bank&64)===0?0x400000:0);}
     }else{
      if(mapping===F.MAP.LOROM){if(addr>=0x8000)off=((bank&127)<<15)|(addr&32767);}
      if(mapping===F.MAP.EXLOROM){if(addr>=0x8000)off=(((bank&127)<<15)|(addr&32767))+(bank<0x80?0x400000:0);}
      if(mapping===F.MAP.HIROM){if(addr>=0x8000||full)off=((bank&63)<<16)|addr;}
      if(mapping===F.MAP.EXHIROM){if(addr>=0x8000||full)off=(((bank&63)<<16)|addr)+(bank<0x80?0x400000:0);}
     }
    }
    const expected=off===null?null:legacy(size,off);
    assert.equal(F.snesToRom(rom,(bank<<16)|addr),expected,`ROM ${size},bank ${bank.toString(16)},addr ${addr.toString(16)}`);
    tests++;
   }
  }
 }
}
const template=F.generateProject(F.loadRom(F.makeSyntheticRom(),'template.sfc'),F.analyze(F.loadRom(F.makeSyntheticRom(),'template.sfc'),4096));
// REV174: verify emitted C++ behavior rather than requiring an absent
// optimization spelling. The recursive mapping remains the public contract.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-mirror-rev174-'));
try{
 for(const[n,v]of Object.entries(template))if(n.startsWith('src/')&&n.endsWith('.hpp')){const f=path.join(dir,n);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
 let checks='';for(const size of [1,2,3,7,8,31,32,65536,131072,262144,524288,786432,1048576,1572864,4194304])for(let off=0;off<0x1000000;off+=0x1f135)checks+='assert(SnesRuntime::mirrorOffset('+size+'u,'+off+'u)=='+legacy(size,off)+'u);\n';
 fs.writeFileSync(path.join(dir,'probe.cpp'),'#include "runtime.hpp"\n#include <cassert>\nint main(){'+checks+'}');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-DFORJA65_ENABLE_TRACE=0','-Isrc','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('REV136 mirror mapping regression PASS',tests,'JS cases and emitted C++ probe (no speed claim)');
