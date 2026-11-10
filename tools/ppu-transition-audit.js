#!/usr/bin/env node
'use strict';
// Forja65: classify actual PPU blackout evidence independently from game progress.
// A black image is not, by itself, a proof that the runtime is stuck or playable.
const fs=require('node:fs'), path=require('node:path');
function options(argv){
  const o={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])throw Error('Expected --key value');o[argv[i].slice(2)]=argv[i+1];}
  if(!o.captures)throw Error('Usage: --captures DIR [--hashes FILE] [--out FILE]');
  return o;
}
function parseScene(data){
  const result={};for(const line of data.split(/\r?\n/)){
    const m=line.match(/^(brightness|source_frame|framebuffer_hash_fnv1a64|mode|tm)\s+(\S+)/);
    if(m)result[m[1]]=m[2];
  }
  return result;
}
function ppmStats(buf){
  // Only binary P6 RGB with maxval=255; reject anything other than an exact buffer.
  const header=buf.subarray(0,96).toString('latin1').match(/^P6\s+(\d+)\s+(\d+)\s+255\s/);
  if(!header)throw Error('Unsupported PPM header');
  const w=Number(header[1]),h=Number(header[2]);const start=Buffer.byteLength(header[0],'latin1');
  if(!w||!h||w>4096||h>4096||buf.length!==start+w*h*3)throw Error('PPM dimensions or bytes invalid');
  let black=0,nonblack=0;
  for(let j=start;j<buf.length;j+=3){if(buf[j]===0&&buf[j+1]===0&&buf[j+2]===0)black++;else nonblack++;}
  return {width:w,height:h,black_pixels:black,nonblack_pixels:nonblack,fully_black:nonblack===0};
}
function parseHashes(data){
  const frames=[];const seen=new Set();
  for(const line of data.split(/\r?\n/)){
    const m=line.match(/^frame=(\d+) framebuffer=([0-9a-f]+) wram=([0-9a-f]+)/i);
    if(!m)continue;const index=Number(m[1]);if(seen.has(index))throw Error('Duplicate frame '+index);
    seen.add(index);frames.push({frame:index,framebuffer:m[2].toLowerCase(),wram:m[3].toLowerCase()});
  }
  return frames;
}
function analyze(capturesDir,hashFile){
  const rows=[];
  for(const dir of fs.readdirSync(capturesDir).sort()){
    const full=path.join(capturesDir,dir);
    if(!fs.statSync(full).isDirectory()||!/^frame-\d+$/.test(dir))continue;
    const sceneFile=fs.readdirSync(full).find(f=>/^frame-\d+\.nscene$/.test(f));
    const ppm=path.join(full,'preview.ppm');if(!sceneFile||!fs.existsSync(ppm))throw Error('Incomplete capture '+full);
    const scene=parseScene(fs.readFileSync(path.join(full,sceneFile),'utf8'));
    if(!/^\d+$/.test(scene.source_frame||'')||!/^\d+$/.test(scene.brightness||''))throw Error('Missing scene evidence '+full);
    if(Number(scene.source_frame)!==Number(dir.slice(6)))throw Error('Capture frame disagreement '+full);
    const pixel=ppmStats(fs.readFileSync(ppm));const brightness=Number(scene.brightness);
    const category=brightness===0?'PPU_BRIGHTNESS_ZERO':pixel.fully_black?'BLACK_WITH_BRIGHTNESS':'VISIBLE_PIXELS';
    rows.push({frame:Number(scene.source_frame),brightness,category,...pixel,framebuffer:scene.framebuffer_hash_fnv1a64||null});
  }
  if(!rows.length)throw Error('No complete scene captures in '+capturesDir);
  const hashes=hashFile&&fs.existsSync(hashFile)?parseHashes(fs.readFileSync(hashFile,'utf8')):[];
  const byFrame=new Map(hashes.map(row=>[row.frame,row]));
  for(const row of rows){
    const h=byFrame.get(row.frame);
    row.hash_verified=h?row.framebuffer===h.framebuffer:null;
    if(row.hash_verified===false)throw Error('Frame-hash mismatch at '+row.frame);
  }
  return {schema:1,explanation:'Blackout evidence does not prove a crash or a game phase; input and reference-frame validation remain necessary.',frames_in_hash_log:hashes.length,captures:rows,all_captures_black:rows.every(r=>r.fully_black)};
}
if(require.main===module){
  try{const o=options(process.argv.slice(2));const r=analyze(path.resolve(o.captures),o.hashes?path.resolve(o.hashes):null);
    if(o.out)fs.writeFileSync(path.resolve(o.out),JSON.stringify(r,null,2)+'\n');
    for(const c of r.captures)console.log(`frame=${c.frame} brightness=${c.brightness} kind=${c.category} pixels_not_black=${c.nonblack_pixels} hash=${c.hash_verified===null?'not-checked':c.hash_verified?'valid':'invalid'}`);
    console.log('Capture evidence only; gameplay is not established.');
  }catch(e){console.error(e.message);process.exitCode=2;}
}
module.exports={options,parseScene,ppmStats,parseHashes,analyze};
