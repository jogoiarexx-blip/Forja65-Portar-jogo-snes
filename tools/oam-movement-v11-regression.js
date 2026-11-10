'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {compare}=require('./oam-movement-audit.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-oam-v11-'));
function write(name,rom,frame,x){const d=path.join(tmp,name);fs.mkdirSync(d);fs.writeFileSync(path.join(d,'capture-manifest.txt'),`FORJA65_SCENE_CAPTURE 1\nsource_frame=${frame}\ncart_hash_fnv1a64=${rom}\nframebuffer_hash_fnv1a64=1234567890abcdef\n`);fs.writeFileSync(path.join(d,'oam-sprites.txt'),`FORJA65_OAM_SPRITES 2\nslot=0 x=${x} y=118 width=16 height=16 tile=72 attr=32 hflip=0 vflip=0 visible_pixels=197\n`);return d;}
try{
 const a=write('a','278768332a4ffc4a',4300,53),left=write('left','278768332a4ffc4a',4300,28),right=write('right','278768332a4ffc4a',4300,80),wrongFrame=write('frame','278768332a4ffc4a',4299,0),wrongRom=write('rom','aaaaaaaaaaaaaaaa',4300,0);
 assert.equal(compare(a,left,0).dx,-25);
 assert.equal(compare(a,right,0).dx,27);
 assert.equal(compare(a,a,0).status,'NO_POSITION_CHANGE');
 assert.throws(()=>compare(a,wrongFrame,0),/Different capture frames/);
 assert.throws(()=>compare(a,wrongRom,0),/ROM mismatch/);
 assert.throws(()=>compare(a,right,1),/Missing OAM slot/);
 console.log('oam-movement v11: 6/6 tests passed');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
