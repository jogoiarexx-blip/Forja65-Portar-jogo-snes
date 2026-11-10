'use strict';
const fs=require('fs'),path=require('path');
function attach(files,header){
 let d=files['src/dispatch.cpp'];if(!d||d.includes('forja65_scpu_aot_step(cpu,hw,cur)'))return files;
 const anchor='hw.dispatchPending=false;const auto requested=cur;';
 if(d.split(anchor).length!==2)throw Error('SCPU observed AOT: dispatcher boundary not unique');
 const step=`hw.dispatchPending=false;cpu.pb=std::uint8_t(cur>>16);
  if(forja65_scpu_aot.step){
   if(hw.serviceCpuEvents(cpu,cur)||forja65_scpu_aot_step(cpu,hw,cur)){
    if(hw.stopped)return;
    if(!hw.dispatchPending&&!continueInternalReturn())return;
    hookEligible=hw.nativeCallPending;hw.nativeCallPending=false;src=hw.dispatchFrom;cur=hw.dispatchTarget;continue;
   }
  }
  `;
 d='#include "forja_scpu_aot.hpp"\n'+d.replace(anchor,step+anchor);
 const old='void forja65_flow_or_interpret(CpuState&cpu,SnesRuntime&hw,std::uint32_t from,std::uint32_t target){if(forja65_interpreter_enabled())';
 // Interpreter-free dispatchers have no fallback helper to patch.
 d=d.replace(old,old.replace('if(forja65_interpreter_enabled())','if(forja65_interpreter_enabled()||forja65_scpu_aot.step)'));
 files['src/dispatch.cpp']=d;files['src/forja_scpu_aot.hpp']=header;
 files['src/main.cpp']='#include "forja_scpu_aot.hpp"\n'+files['src/main.cpp'].replace('forja65_sa1_start(hw);','forja65_sa1_start(hw);forja65_scpu_aot_start(hw);');
 files['CMakeLists.txt']+='\nfile(GLOB FORJA65_OBSERVED_AOT_PARTS CONFIGURE_DEPENDS src/forja_sa1_aot_part_*.cpp src/forja_scpu_aot_part_*.cpp)\ntarget_sources(forja65_generated PRIVATE ${FORJA65_OBSERVED_AOT_PARTS})\nif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/src/forja_scpu_aot.cpp")\n target_sources(forja65_generated PRIVATE src/forja_scpu_aot.cpp)\nendif()\n';
 return files;
}
function install(port){const files={};for(const name of ['src/dispatch.cpp','src/main.cpp','CMakeLists.txt'])files[name]=fs.readFileSync(path.join(port,name),'utf8');
 attach(files,fs.readFileSync(path.join(__dirname,'../native/forja_scpu_aot.hpp'),'utf8'));
 for(const [name,data]of Object.entries(files))fs.writeFileSync(path.join(port,name),data);
}
if(require.main===module)install(process.argv[2]);module.exports={attach,install};
