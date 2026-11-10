#!/usr/bin/env node
'use strict';
// ROM-agnostic analysis of the actual Forja65 scene export. Never synthesizes graphics.
const fs=require('node:fs');
const path=require('node:path');
function analyzeScene(dir){
  const manifest=fs.readFileSync(path.join(dir,'capture-manifest.txt'),'utf8');
  const match=manifest.match(/^source_frame=(\d+)$/m);
  if(!match)throw Error('scene export missing source_frame');
  const nscene=fs.readdirSync(dir).find(f=>f.endsWith('.nscene'));
  if(!nscene)throw Error('missing .nscene');
  const scene=fs.readFileSync(path.join(dir,nscene),'utf8');
  const field=(name)=>{const m=scene.match(new RegExp('^'+name+' ([^\\r\\n]+)$','m'));if(!m)throw Error('missing '+name);return m[1];};
  const vram=fs.readFileSync(path.join(dir,'vram.bin'));
  const cgram=fs.readFileSync(path.join(dir,'cgram.bin'));
  const oam=fs.readFileSync(path.join(dir,'oam.bin'));
  if(vram.length!==65536||cgram.length!==512||oam.length!==544)throw Error('invalid VRAM/CGRAM/OAM length');
  const tm=Number(field('tm')),ts=Number(field('ts')),mode=Number(field('mode')),brightness=Number(field('brightness'));
  const total=v=>[...v].reduce((n,x)=>n+(x!==0),0);
  let placeholder=0, populated=0;
  for(let i=0;i<128;i++){
    const p=i*4;
    // Recognize one repeated initialization pattern, not an assertion of visibility.
    if(oam[p]===0&&oam[p+1]===0&&oam[p+2]===255&&oam[p+3]===240)placeholder++;
    else populated++;
  }
  const ppm=fs.readFileSync(path.join(dir,'preview.ppm'));
  const header=ppm.subarray(0,100).toString('ascii').match(/^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/);
  if(!header)throw Error('invalid preview.ppm P6 header');
  const width=Number(header[1]),height=Number(header[2]),max=Number(header[3]);
  if(max!==255)throw Error('preview.ppm maxcolor is not 255');
  const start=Buffer.byteLength(header[0],'ascii');
  if(ppm.length-start!==width*height*3)throw Error('preview.ppm pixel byte length mismatch');
  let nonBlackPixels=0;
  for(let p=start;p<ppm.length;p+=3)if(ppm[p]||ppm[p+1]||ppm[p+2])nonBlackPixels++;
  return {
    schema:'forja65.scene-audit.v1',sourceFrame:Number(match[1]),width,height,
    ppu:{mode,tm,ts,brightness,bgMainMask:tm&15,bgSubMask:ts&15,objMainEnabled:Boolean(tm&16),objSubEnabled:Boolean(ts&16),visibleBgEnabled:Boolean((tm|ts)&15)},
    raw:{vramNonzeroBytes:total(vram),cgramNonzeroBytes:total(cgram),oamNonzeroBytes:total(oam),oamRepeatedInitializerPattern:placeholder,oamOtherEntries:populated},
    image:{nonBlackPixels,blackPixels:width*height-nonBlackPixels},
    interpretation:(!((tm|ts)&15)&&Boolean((tm|ts)&16))?'Only OBJ output is enabled by TM/TS in this snapshot; do not attribute missing BG to a Mode7 renderer bug.':'Review output-mask and sprite state alongside the pixel capture.'
  };
}
if(require.main===module){try{const dir=process.argv[2];if(!dir)throw Error('Usage: node inspect-scene.js CAPTURE_DIR [OUTPUT_JSON]');const result=JSON.stringify(analyzeScene(dir),null,2)+'\n';if(process.argv[3])fs.writeFileSync(process.argv[3],result);process.stdout.write(result);}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={analyzeScene};
