#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {patchAotFrontier}=require('../forja65-core.js');
const port=path.resolve(process.argv[2]||'');
if(!process.argv[2]||!fs.existsSync(path.join(port,'src','dispatch.cpp'))){console.error('Uso: node tools/enable-aot-frontier.js PASTA-PORT');process.exit(2);}
const files={};for(const name of ['src/dispatch.cpp','src/forja_aot_frontier.hpp']){
  const p=path.join(port,name);if(fs.existsSync(p))files[name]=fs.readFileSync(p,'utf8');
}
const before=files['src/dispatch.cpp'];patchAotFrontier(files);
for(const [name,body] of Object.entries(files))if(name==='src/forja_aot_frontier.hpp'||name==='src/dispatch.cpp')fs.writeFileSync(path.join(port,name),body);
console.log('AOT_FRONTIER '+(before===files['src/dispatch.cpp']?'ALREADY_INSTALLED':'INSTALLED')+' '+port);
