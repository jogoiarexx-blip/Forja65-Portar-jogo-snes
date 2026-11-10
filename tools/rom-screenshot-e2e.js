#!/usr/bin/env node
'use strict';
// Forja65 REV132 — end-to-end check on real SNES test ROMs with reference screenshots.
// For every <name>.sfc that has a <name>.png beside it (e.g. PeterLemon/SNES CPUTest), the ROM is
// analysed, recompiled to a native port, built (headless) and executed; the final frame is
// compared pixel by pixel (15-bit colour space) with the reference screenshot, under one or more
// SPC700 profiles. ROMs and screenshots are NOT shipped with Forja65; pass the folder in.
// Usage: node tools/rom-screenshot-e2e.js <folder> [--frames 3000] [--profiles default,reference,legacy] [--json out.json]
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),zlib=require('zlib');
function arg(n,d){const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;}
const root=process.argv[2];if(!root){console.error('uso: node tools/rom-screenshot-e2e.js <pasta-com-sfc-e-png>');process.exit(2);}
const corePath=path.resolve(arg('--core',path.join(__dirname,'..','forja65-core.js')));const F=require(corePath);
const frames=+arg('--frames','3000');const profiles=arg('--profiles','default,reference,legacy').split(',');
const cxx=process.env.CXX||'g++';
function decodePng(buf){
  if(buf.readUInt32BE(0)!==0x89504e47)throw new Error('PNG invalido');let o=8,w=0,h=0,ct=0,bd=0;const idat=[];let pal=null;
  while(o<buf.length){const len=buf.readUInt32BE(o),type=buf.toString('ascii',o+4,o+8),data=buf.subarray(o+8,o+8+len);o+=12+len;
    if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);bd=data[8];ct=data[9];if(data[12])throw new Error('PNG entrelacado nao suportado');}
    else if(type==='PLTE')pal=data;else if(type==='IDAT')idat.push(data);else if(type==='IEND')break;}
  if(bd!==8)throw new Error('PNG precisa ter 8 bits por canal');
  const bpp={2:3,6:4,3:1,0:1,4:2}[ct];const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*bpp,px=Buffer.alloc(w*h*3);let prev=Buffer.alloc(stride);
  for(let y=0;y<h;y++){const f=raw[y*(stride+1)],line=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));
    for(let x=0;x<stride;x++){const a=x>=bpp?line[x-bpp]:0,b=prev[x],c=x>=bpp?prev[x-bpp]:0;let v=line[x];
      if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}
      line[x]=v&255;}
    for(let x=0;x<w;x++){let r,g,b;if(ct===2||ct===6){r=line[x*bpp];g=line[x*bpp+1];b=line[x*bpp+2];}else if(ct===3){const i=line[x];r=pal[i*3];g=pal[i*3+1];b=pal[i*3+2];}else{r=g=b=line[x*bpp];}
      px[(y*w+x)*3]=r;px[(y*w+x)*3+1]=g;px[(y*w+x)*3+2]=b;}
    prev=line;}
  return {w,h,px};
}
function readPpm(file){const b=fs.readFileSync(file);let p=0;const tok=()=>{while(b[p]===0x20||b[p]===0x0a||b[p]===0x0d||b[p]===0x09)p++;if(b[p]===0x23){while(b[p]!==0x0a)p++;return tok();}let s='';while(p<b.length&&!(b[p]===0x20||b[p]===0x0a||b[p]===0x0d||b[p]===0x09))s+=String.fromCharCode(b[p++]);return s;};
  if(tok()!=='P6')throw new Error('PPM P6 esperado');const w=+tok(),h=+tok(),max=+tok();p++;if(max!==255)throw new Error('PPM maxval');return {w,h,px:b.subarray(p,p+w*h*3)};}
function compare(a,b){if(a.w!==b.w||a.h!==b.h)return {diff:-1,size:`${a.w}x${a.h} vs ${b.w}x${b.h}`};let d=0;for(let i=0;i<a.w*a.h;i++){for(let c=0;c<3;c++)if((a.px[i*3+c]>>3)!==(b.px[i*3+c]>>3)){d++;break;}}return {diff:d};}
function build(romFile,dir){
  const rom=F.loadRom(fs.readFileSync(romFile),path.basename(romFile));const a=F.analyze(rom);const files=F.generateProject(rom,a);
  fs.rmSync(dir,{recursive:true,force:true});for(const [k,v] of Object.entries(files)){const f=path.join(dir,k);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
  const src=path.join(dir,'src'),flags=['-std=c++20','-O1','-w','-I'+src];
  cp.execFileSync(cxx,[...flags,'-x','c++-header',path.join(src,'runtime.hpp'),'-o',path.join(src,'runtime.hpp.gch')]);
  const objs=[];for(const k of Object.keys(files).filter(k=>/^src\/.*\.cpp$/.test(k))){const o=path.join(dir,k.replace(/\.cpp$/,'.o'));cp.execFileSync(cxx,[...flags,'-c',path.join(dir,k),'-o',o]);objs.push(o);}
  const exe=path.join(dir,process.platform==='win32'?'port.exe':'port');
  cp.execFileSync(cxx,[...objs,'-o',exe].concat(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:['-lpthread']));
  return {exe,functions:(a.functions||[]).length};
}
const cases=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.sfc$/i.test(e.name)){const png=p.replace(/\.sfc$/i,'.png');if(fs.existsSync(png))cases.push({rom:p,png});}}})(root);
cases.sort((a,b)=>a.rom.localeCompare(b.rom));
const work=fs.mkdtempSync(path.join(os.tmpdir(),'forja-e2e-'));const results=[];
try{
  for(const c of cases){
    const name=path.basename(c.rom,'.sfc');const dir=path.join(work,name);const ref=decodePng(fs.readFileSync(c.png));const row={rom:name};
    try{const b=build(c.rom,dir);row.functions=b.functions;
      for(const prof of profiles){const cap=path.join(dir,'cap-'+prof);const env={...process.env,FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:String(frames),FORJA65_CAPTURE_FRAME:String(frames-10),FORJA65_CAPTURE_DIR:cap};
        if(prof!=='default')env.FORJA65_SPC_PROFILE=prof;
        const r=cp.spawnSync(b.exe,[],{cwd:dir,env,encoding:'utf8',timeout:600000});
        const ppm=path.join(cap,'preview.ppm');row[prof]=fs.existsSync(ppm)?compare(readPpm(ppm),ref).diff:('erro:'+((r.stderr||'').trim().split('\n').pop()||r.status));}
    }catch(e){row.error=String(e.message||e).split('\n')[0];}
    results.push(row);console.log(JSON.stringify(row));
  }
}finally{if(!process.env.FORJA65_E2E_KEEP)fs.rmSync(work,{recursive:true,force:true});}
const summary={};for(const p of profiles)summary[p]={exact:results.filter(r=>r[p]===0).length,total:results.length};
console.log('ROM_SCREENSHOT_E2E '+JSON.stringify(summary));
if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify({frames,profiles,results,summary},null,1));
