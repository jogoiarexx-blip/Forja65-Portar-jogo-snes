'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');const root=path.resolve(__dirname,'..');const results=[];
for(const name of fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.js')).sort()){const start=Date.now(),r=cp.spawnSync(process.execPath,[path.join(root,'tests',name)],{encoding:'utf8'});const passed=!r.error&&r.status===0;results.push({test:name,passed,seconds:(Date.now()-start)/1000});console.log((passed?'PASS ':'FAIL ')+name);if(!passed)console.error(r.error||r.stderr||r.stdout);}
console.log(results.filter(x=>x.passed).length+'/'+results.length+' passed');if(results.some(x=>!x.passed))process.exitCode=1;
