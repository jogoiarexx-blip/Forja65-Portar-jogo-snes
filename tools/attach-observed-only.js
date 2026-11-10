'use strict';
const fs=require('fs'),path=require('path');
function attachObservedOnly(files,driver){
 files['src/forja_observed_cpu.cpp']=driver;
 let cm=files['CMakeLists.txt'];if(!cm||cm.includes('option(FORJA65_OBSERVED_ONLY'))return files;
 const match=cm.match(/^add_library\(forja65_generated OBJECT [^\n]+\)$/m);
 if(!match)throw Error('Observed-only build: generated object-library boundary missing');
 cm=cm.replace(match[0],`option(FORJA65_OBSERVED_ONLY "Execute observed SCPU AOT only; omit CPU interpreters and static CFG" OFF)
if(FORJA65_OBSERVED_ONLY)
  add_library(forja65_generated OBJECT src/native_hooks.cpp src/forja_observed_cpu.cpp)
  target_compile_definitions(forja65_generated PRIVATE FORJA65_SA1_NO_INTERPRETER=1)
else()
  ${match[0]}
endif()`);
 cm=cm.replace(/^target_sources\(forja65_generated PRIVATE src\/forja_cpu_interpreter.cpp\)$/m,'if(NOT FORJA65_OBSERVED_ONLY)\n target_sources(forja65_generated PRIVATE src/forja_cpu_interpreter.cpp)\nendif()');
 files['CMakeLists.txt']=cm;return files;
}
function install(port){const files={'CMakeLists.txt':fs.readFileSync(path.join(port,'CMakeLists.txt'),'utf8')};attachObservedOnly(files,fs.readFileSync(path.join(__dirname,'../native/forja_observed_cpu.cpp'),'utf8'));for(const[name,data]of Object.entries(files))fs.writeFileSync(path.join(port,name),data);}
if(require.main===module)install(process.argv[2]);module.exports={attachObservedOnly,install};
