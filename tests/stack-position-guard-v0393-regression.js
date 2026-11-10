'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),C=require('../forja65-core');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-stack-position-'));
try{const r=C.loadRom(C.makeSyntheticRom()),p=C.generateProject(r,C.analyze(r,512));
 fs.writeFileSync(path.join(d,'runtime.hpp'),p['src/runtime.hpp']);
 fs.writeFileSync(path.join(d,'forja_trace.hpp'),p['src/forja_trace.hpp']);fs.writeFileSync(path.join(d,'forja_ir.hpp'),p['src/forja_ir.hpp']);
 cp.execFileSync('g++',['-std=c++20','-O1','-I',d,path.join(__dirname,'return_stack_guard_v0393.cpp'),'-o',path.join(d,'test')],{stdio:'inherit'});
 cp.execFileSync(path.join(d,'test'),[],{stdio:'inherit'});
 if(!p['CMakeLists.txt'].includes('add_test(NAME return_stack_position COMMAND return_stack_guard_v0393)'))throw Error('missing generated CTest');
}finally{fs.rmSync(d,{recursive:true,force:true});}
