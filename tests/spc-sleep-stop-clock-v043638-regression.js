'use strict';
const assert=require('node:assert/strict');
const run=require('./fixtures/run_spc_probe_v0431');
const files=run('spc-halt-v043638',String.raw`
void envProfile(const char* v){
#ifdef _WIN32
 _putenv_s("FORJA65_SPC_PROFILE",v);
#else
 if(*v)setenv("FORJA65_SPC_PROFILE",v,1);else unsetenv("FORJA65_SPC_PROFILE");
#endif
}
int main(){
 for(const char*profile:{"legacy","reference"})for(unsigned opcode:{0xEFu,0xFFu})for(unsigned chunk:{1u,17u,6710u}){
  envProfile(profile);
  ApuBridge a;
  a.spc.control=0;a.spc.pc=0x200;a.spc.ram[0x200]=(std::uint8_t)opcode;
  a.spc.ram[0x201]=0xE8; // MOV A, #0x7A must never execute
  a.spc.ram[0x202]=0x7A;a.spc.setA(0x35);
  a.setNativeDsp(true);
  a.tickMasterCycles(6710u);
  assert(a.spc.pc==0x201u);
  assert(a.spc.sleeping==(opcode==0xEFu));
  assert(a.spc.stopped==(opcode==0xFFu));
  assert(a.spc.a()==0x35u);
  if(a.spcExecutedCycles!=(a.accurateSpcTiming?(opcode==0xEFu?3u:2u):2u)){std::cerr<<"FAIL profile="<<profile<<" op="<<opcode<<" chunk="<<chunk<<" cycles="<<a.spcExecutedCycles<<" actualAccurate="<<a.accurateSpcTiming<<"\n";return 17;}
  const auto beforeSteps=a.spcExecutedCycles;
  const auto beforeAudio=a.dspNativeSamples;
  for(unsigned i=0;i<800u;++i)a.tickMasterCycles(chunk); // REV195: >= 1 periodo de amostra (670,3 ciclos mestres a 32.040 Hz) mesmo com chunk=1
  assert(a.spcExecutedCycles==beforeSteps);
  assert(a.spc.pc==0x201u&&a.spc.a()==0x35u);
  assert(a.dspNativeSamples>beforeAudio); // DSP advances independently after SPC halt
  assert(a.ntscCycleCredit==0&&a.spcMasterRemainder==0);
  assert(forja65SpcStep(a)==0);
 }
 envProfile("");
 std::cout<<"SPC_SLEEP_STOP_CLOCK_V043638_PASS cases=12 halt_no_repeat=YES DSP_continues=YES\n";
}
`);
assert.ok(files['src/runtime.hpp'].includes('spc.sleeping||spc.stopped'));
console.log('SPC_SLEEP_STOP_INTEGRATION_PASS');
