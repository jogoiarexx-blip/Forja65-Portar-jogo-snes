'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'obj-oam-order-v0389.sfc');
const header=F.generateProject(rom,F.analyze(rom,256,[]))['src/runtime.hpp'];
assert(header.includes('const unsigned first=(regs[3]&0x80u)'));
assert(!header.includes('depth>best.priority||(depth==best.priority&&i<best.oamIndex)'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-obj-oam-order-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.writeFileSync(path.join(dir,'test.cpp'),String.raw`
#include "runtime.hpp"
#include <iostream>
int main(){
 PpuState p;p.tm=0x11;p.brightness=15;p.bgmode=1;p.bgsc[0]=4;
 for(unsigned i=0;i<128;i++)p.oam[512+i/4]|=std::uint8_t(1u<<((i%4)*2));
 for(unsigned i=0;i<2;i++){p.oam[i*4]=32;p.oam[i*4+1]=40;p.oam[i*4+2]=0;p.oam[512+i/4]&=std::uint8_t(~(3u<<((i%4)*2)));}
 p.oam[3]=0;p.oam[7]=0x32;p.vram[0]=0x80;p.vram[32]=0x80;
 const unsigned map=0x800+2*(4+5*32);p.vram[map]=1;
 if(p.sampleSprites(32,40).oamIndex!=0||p.buildSpriteRow(40)[32].oamIndex!=0)return 1;
 if(p.compose(32,40,false).source!=0)return 2;
 p.regs[3]=0x80;p.oamAddr=2;
 if(p.sampleSprites(32,40).oamIndex!=1||p.buildSpriteRow(40)[32].oamIndex!=1)return 3;
 if(p.compose(32,40,false).source!=4)return 4;
 std::cout<<"FORJA_OBJ_OAM_ORDER_GENERATED_PASS\n";
}
`);
 const compiled=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-g0','-I',dir,path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{encoding:'utf8',cwd:dir});
 assert.equal(compiled.status,0,compiled.stderr||String(compiled.error));
 const executed=cp.spawnSync(path.join(dir,'test'),[],{encoding:'utf8',cwd:dir});
 assert.equal(executed.status,0,executed.stderr||executed.stdout||String(executed.error));
 console.log('FORJA_OBJ_OAM_ORDER_V0389_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
