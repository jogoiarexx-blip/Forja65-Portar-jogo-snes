#!/usr/bin/env node
'use strict';
/* Compare pixel data in P6 captures from two deterministic replays.
 * Pixel changes are evidence, not a claim of character movement. */
const fs=require('node:fs');
const path=require('node:path');
function ppm(bytes){
  if(!Buffer.isBuffer(bytes))throw Error('PPM data must be a Buffer');
  let pos=0;
  function token(){
    while(pos<bytes.length){
      const c=bytes[pos];
      if(c===35){while(pos<bytes.length && bytes[pos]!==10)pos++;continue;}
      if(c===9||c===10||c===13||c===32){pos++;continue;}
      break;
    }
    const start=pos;
    while(pos<bytes.length && bytes[pos]>32 && bytes[pos]!==35)pos++;
    if(start===pos)throw Error('Truncated PPM header');
    return bytes.toString('ascii',start,pos);
  }
  if(token()!=='P6')throw Error('Expected binary P6 PPM');
  const width=Number(token()), height=Number(token()), max=Number(token());
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>80e6)throw Error('Invalid PPM dimensions');
  if(max!==255)throw Error('Only 8-bit P6 images supported');
  if(pos>=bytes.length||![9,10,13,32].includes(bytes[pos]))throw Error('No PPM pixel-data delimiter');
  // Strictly consume one PPM data delimiter, CRLF is a single line ending.
  const delimiter=bytes[pos++];if(delimiter===13&&bytes[pos]===10)pos++;
  const expected=width*height*3;
  if(bytes.length-pos!==expected)throw Error('Unexpected PPM byte count: '+(bytes.length-pos)+' (expected '+expected+')');
  return {width,height,pixels:bytes.subarray(pos)};
}
function compare(a,b,{threshold=0,gridX=4,gridY=4}={}){
  if(a.width!==b.width||a.height!==b.height)throw Error('Different frame dimensions');
  if(!Number.isSafeInteger(threshold)||threshold<0||threshold>255)throw Error('Invalid threshold');
  if(!Number.isSafeInteger(gridX)||gridX<1||gridX>16||!Number.isSafeInteger(gridY)||gridY<1||gridY>16)throw Error('Invalid grid');
  const cells=Array.from({length:gridY},(_,y)=>Array.from({length:gridX},(_,x)=>({x,y,changed:0,pixels:0})));
  let changed=0, sumRgbAbsoluteDifference=0;
  let minX=a.width,minY=a.height,maxX=-1,maxY=-1;
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
    const i=(y*a.width+x)*3;
    const dr=Math.abs(a.pixels[i]-b.pixels[i]);
    const dg=Math.abs(a.pixels[i+1]-b.pixels[i+1]);
    const db=Math.abs(a.pixels[i+2]-b.pixels[i+2]);
    const changedPixel=Math.max(dr,dg,db)>threshold;
    const cell=cells[Math.min(gridY-1,Math.floor(y*gridY/a.height))][Math.min(gridX-1,Math.floor(x*gridX/a.width))];
    cell.pixels++;
    if(!changedPixel)continue;
    changed++;sumRgbAbsoluteDifference+=dr+dg+db;cell.changed++;
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  return {width:a.width,height:a.height,changed_pixels:changed,total_pixels:a.width*a.height,changed_percent:Number((changed/(a.width*a.height)*100).toFixed(3)),
    mean_rgb_abs_difference_of_changed_pixels:changed?Number((sumRgbAbsoluteDifference/(changed*3)).toFixed(2)):0,
    changed_bbox:changed?{x_min:minX,y_min:minY,x_max:maxX,y_max:maxY}:null,
    grid:cells.map(row=>row.map(c=>({changed:c.changed,pixels:c.pixels,percent:Number((c.changed/c.pixels*100).toFixed(2))}))),
    gameplay_validated:false};
}
function parseArgs(args){
  const o={};for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1])throw Error('Expected --option value');o[args[i].slice(2)]=args[i+1];}
  for(const field of ['baseline','variant','out'])if(!o[field])throw Error('Missing --'+field);
  return o;
}
function main(argv){
  const o=parseArgs(argv);
  const opts={threshold:Number(o.threshold||0),gridX:Number(o['grid-x']||4),gridY:Number(o['grid-y']||4)};
  const result=compare(ppm(fs.readFileSync(path.resolve(o.baseline))),ppm(fs.readFileSync(path.resolve(o.variant))),opts);
  result.schema=1;result.baseline=path.resolve(o.baseline);result.variant=path.resolve(o.variant);result.threshold=opts.threshold;
  result.caveat='Pixel differences alone cannot establish free movement: verify the same input timing, sprite location and animation over consecutive frames.';
  fs.mkdirSync(path.dirname(path.resolve(o.out)),{recursive:true});fs.writeFileSync(path.resolve(o.out),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({changed_pixels:result.changed_pixels,changed_percent:result.changed_percent,bbox:result.changed_bbox,gameplay_validated:false}));
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={ppm,compare,parseArgs};
