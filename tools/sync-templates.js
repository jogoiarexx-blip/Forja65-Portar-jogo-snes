const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const files={};for(const n of ['forja_trace.hpp','forja_ir.hpp'])files['src/'+n]=fs.readFileSync(path.join(root,'native',n),'utf8');
files['tools/native_oracle_build.py']=fs.readFileSync(path.join(root,'tools/native_oracle_build.py'),'utf8');
files['docs/NATIVE-ORACLE-BUILD.txt']=fs.readFileSync(path.join(root,'native/native-oracle-build.txt'),'utf8');
files['tests/framework_smoke.cpp']=fs.readFileSync(path.join(root,'native/framework_smoke.cpp'),'utf8');
fs.writeFileSync(path.join(root,'native/templates.js'),`(function(r){const t=${JSON.stringify(files)};if(typeof module==='object'&&module.exports)module.exports=t;r.Forja65Templates=t;})(typeof globalThis!=='undefined'?globalThis:this);\n`);
