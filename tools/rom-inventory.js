#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),C=require('../forja65-core'),{createInventoryCache}=require('./rie-cache');
function main(args){
 const options={max:65536},allowed=new Set(['--rom','--out','--max','--hints','--knowledge']);
 for(let n=0;n<args.length;n++){if(!allowed.has(args[n])||args[n+1]===undefined)throw new Error('Uso: node tools/rom-inventory.js --rom jogo.sfc --out pasta [--max 65536] [--hints arquivo.txt] [--knowledge pack.json]');options[args[n].slice(2)]=args[++n];}
 if(!options.rom||!options.out)throw new Error('Informe --rom e --out.');
 const max=Number(options.max);if(!Number.isInteger(max)||max<1||max>1000000)throw new Error('--max deve ser inteiro entre 1 e 1000000');
 const out=path.resolve(options.out),rom=C.loadRom(new Uint8Array(fs.readFileSync(options.rom)),path.basename(options.rom)),cache=createInventoryCache(path.join(out,'rie-scan-cache'));
 const hints=options.hints?fs.readFileSync(options.hints,'utf8'):'',knowledge=options.knowledge?JSON.parse(fs.readFileSync(options.knowledge,'utf8')):null;
 const a=C.analyze(rom,max,hints,{inventoryCache:cache,knowledge});fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'rom-inventory.json'),JSON.stringify(a.romInventory,null,2)+'\n');fs.writeFileSync(path.join(out,'rom-inventory.md'),globalThis.Forja65RomInventory.markdown(a.romInventory));fs.writeFileSync(path.join(out,'analysis.txt'),C.reportText(a));
 console.log(JSON.stringify({rom:a.romFingerprint,mapping:a.mapping,inventoried:a.romInventory.metrics.inventoriedBytes,identifiedCode:a.romInventory.metrics.identifiedCodeBytes,validatedCode:0,cache:a.romInventory.cache.status,scannedBytes:a.romInventory.metrics.physicalBytesScanned}));
}
if(require.main===module)try{main(process.argv.slice(2));}catch(e){console.error('RIE: '+e.message);process.exitCode=1;}
module.exports={main};
