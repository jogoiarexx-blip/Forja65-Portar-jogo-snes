'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('assert');
const C=require('../forja65-core'),{compile}=require('../tools/compile-sa1-observed-rev203');
const port=path.resolve(__dirname,'../../Kirby-Dream-Land-3-Port-v0.3-FULLGAME');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja204-observed-only-'));
try{
 const rom=C.loadRom(C.makeSyntheticRom());const files=C.generateProject(rom,C.analyze(rom,384));
 assert(files['src/forja_observed_cpu.cpp'],'generic exports must include optional observed-only dispatcher');
 for(const [name,data]of Object.entries(files)){if(typeof data==='string'||data instanceof Uint8Array){const p=path.join(dir,'generic',name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);}}
 const cmakeAvailable=!cp.spawnSync('cmake',['--version']).error;
 if(!cmakeAvailable)console.log('SKIP CMake source-selection check: cmake is unavailable');
 for(const on of (cmakeAvailable?[false,true]:[])){
  const build=path.join(dir,'cmake-'+on);
  cp.execFileSync('cmake',['-S',path.join(dir,'generic'),'-B',build,'-DCMAKE_EXPORT_COMPILE_COMMANDS=ON','-DFORJA65_USE_PCH=OFF','-DFORJA65_OBSERVED_ONLY='+(on?'ON':'OFF')],{stdio:'pipe'});
  const cmds=JSON.parse(fs.readFileSync(path.join(build,'compile_commands.json'))).filter(x=>x.command.includes('forja65_generated.dir'));
  const names=cmds.map(x=>path.basename(x.file));
  if(on){assert(names.includes('forja_observed_cpu.cpp'));assert(!names.some(x=>/^(dispatch|generated_\d+|forja_learned_|forja_cpu_interpreter)/.test(x)));assert(cmds.every(x=>x.command.includes('FORJA65_SA1_NO_INTERPRETER=1')));}
  else{assert(names.includes('dispatch.cpp'));assert(names.includes('forja_cpu_interpreter.cpp'));assert(names.some(x=>/^generated_\d+/.test(x)));assert(!names.includes('forja_observed_cpu.cpp'));}
 }
 for(const on of [false,true]){
  const plan=JSON.parse(cp.execFileSync('python',[path.join(port,'tools/build-direct.py'),'--print-plan',...(on?['--observed-only']:[])],{encoding:'utf8'}));
  const names=plan.sources.map(x=>path.basename(x));
  if(on){assert(names.includes('forja_observed_cpu.cpp'));assert(!names.some(x=>/^(dispatch|generated_\d+|forja_learned_|forja_cpu_interpreter)/.test(x)));assert(plan.flags.includes('-DFORJA65_SA1_NO_INTERPRETER=1'));}
  else{assert(names.includes('dispatch.cpp'));assert(names.includes('forja_cpu_interpreter.cpp'));assert(names.some(x=>/^generated_\d+/.test(x)));assert(!names.includes('forja_observed_cpu.cpp'));}
 }
 const src=path.join(dir,'src');fs.mkdirSync(src);
 for(const file of fs.readdirSync(path.join(port,'src')))if(file.endsWith('.hpp'))fs.copyFileSync(path.join(port,'src',file),path.join(src,file));
 fs.writeFileSync(path.join(src,'forja_observed_cpu.cpp'),files['src/forja_observed_cpu.cpp']);
 fs.copyFileSync(path.join(port,'src/forja_sa1_runner.cpp'),path.join(src,'forja_sa1_runner.cpp'));
 const bytes=fs.readFileSync(path.join(port,'assets/cart-data.bin'));
 // Runtime SA1 LoROM reset mapping: $008000 -> offset0 (CLC), $018000 -> offset$8000 (SEI).
 assert.strictEqual(bytes[0],0x18);assert.strictEqual(bytes[0x8000],0x78);
 fs.writeFileSync(path.join(dir,'observed.txt'),[[0x8000,0],[0x18000,0x8000]].map(([pc,off])=>pc.toString(16)+' 7 '+[...bytes.subarray(off,off+4)].map(x=>x.toString(16)).join(' ')).join('\n')+'\n');
 const aot=path.join(src,'forja_scpu_aot.cpp');compile(path.join(dir,'observed.txt'),path.join(port,'src/forja_cpu_interpreter.cpp'),path.join(port,'assets/cart-data.bin'),aot,{cpu:'scpu'});
 fs.copyFileSync(path.join(__dirname,'fixtures/rev204_observed_only.cpp'),path.join(src,'test.cpp'));
 const exe=path.join(dir,'test');cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-DFORJA65_SA1_NO_INTERPRETER=1','-I'+src,...['test.cpp','forja_observed_cpu.cpp','forja_sa1_runner.cpp','forja_scpu_aot.cpp','forja_scpu_aot_part_000.cpp'].map(x=>path.join(src,x)),'-o',exe],{stdio:'inherit'});
 cp.execFileSync(exe,[path.join(port,'assets/cart-data.bin')],{cwd:dir,stdio:'inherit'});
 const symbols=cp.execFileSync('nm',['-C',exe],{encoding:'utf8'});assert(!symbols.includes('forja65_interpret_step('),'interpreter instruction engine linked');
 console.log('REV204_OBSERVED_ONLY_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
