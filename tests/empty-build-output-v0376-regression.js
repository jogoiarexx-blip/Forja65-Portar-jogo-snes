'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {removeEmptyBuildOutputs}=require('../tools/converge');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-empty-build-'));
try{
 for(const [name,bytes]of [['game',''],['CMakeFiles/generated.o',''],['Release/game.exe',''],['nonempty.obj','valid'],['CMakeCache.txt',''],['assets/cart-data.bin','']]){const p=path.join(dir,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);}
 assert.equal(removeEmptyBuildOutputs(dir).length,3);
 for(const n of ['game','CMakeFiles/generated.o','Release/game.exe'])assert(!fs.existsSync(path.join(dir,n)));
 for(const n of ['nonempty.obj','CMakeCache.txt','assets/cart-data.bin'])assert(fs.existsSync(path.join(dir,n)));
 console.log('EMPTY_BUILD_OUTPUT_V0376_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
