'use strict';
// REV143: o padrao do SPC700 passou a 1.025.280 Hz (REV138 reintegrado). Este teste mede a aritmetica
// fracionaria do agendador no relogio nominal; fixa FORJA65_SPC_HZ=1024000.
process.env.FORJA65_SPC_HZ='1024000';
const assert=require('node:assert/strict');
const files=require('./fixtures/run_spc_probe_v0431')('spc-halted-timers-v043639',String.raw`
void envProfile(const char* v){
#ifdef _WIN32
 _putenv_s("FORJA65_SPC_PROFILE",v);
#else
 if(*v)setenv("FORJA65_SPC_PROFILE",v,1);else unsetenv("FORJA65_SPC_PROFILE");
#endif
}
void config(ApuBridge& a,unsigned op,unsigned target){
 a.spc.control=0;a.spc.pc=0x200;a.spc.ram[0x200]=(std::uint8_t)op;
 for(int i=0;i<3;++i)a.spcWrite((std::uint16_t)(0xFA+i),(std::uint8_t)target);
 a.spcWrite(0xF1,7);
}
void sameTimers(const ApuBridge& a,const ApuBridge& b){
 for(int i=0;i<3;++i){
  assert(a.spc.timerDiv[i]==b.spc.timerDiv[i]);
  assert(a.spc.timerStage[i]==b.spc.timerStage[i]);
  assert(a.spc.timerOut[i]==b.spc.timerOut[i]);
 }
 assert(a.spcHaltClockFraction==b.spcHaltClockFraction);
 assert(a.spc.pc==b.spc.pc && a.spcExecutedCycles==b.spcExecutedCycles);
}
int main(){
 envProfile("reference");
 unsigned cases=0;
 // Timer targets are write-only. Timer output registers are read-to-clear and ignore writes.
 for(int i=0;i<3;++i){
  ApuBridge a; a.spc.ram[0xFA+i]=0xAA;
  a.spcWrite((std::uint16_t)(0xFA+i),17);
  assert(a.spc.timerTarget[i]==17 && a.spcRead((std::uint16_t)(0xFA+i))==0);
  a.spc.timerOut[i]=0x0D;
  a.spcWrite((std::uint16_t)(0xFD+i),0xEE);
  assert(a.spc.timerOut[i]==0x0D);
  assert(a.spcRead((std::uint16_t)(0xFD+i))==13);
  assert(a.spcRead((std::uint16_t)(0xFD+i))==0);
  ++cases;
 }
 // All three timers remain clocked in SLEEP and STOP, even when no SPC opcode executes.
 // Compare one host batch with many CPU/DMA-sized batches over identical elapsed time.
 for(unsigned opcode:{0xEFu,0xFFu})for(unsigned target:{0u,1u,3u,255u})for(unsigned total:{677u,6710u,200001u}){
  ApuBridge a,b;config(a,opcode,target);config(b,opcode,target);
  a.tickMasterCycles(total);
  unsigned left=total,seed=1;
  while(left){const unsigned chunk=std::min(left,1u+((seed++*37u)%97u));b.tickMasterCycles(chunk);left-=chunk;}
  assert(a.spc.pc==0x201u && b.spc.pc==0x201u);
  assert(a.spc.sleeping==(opcode==0xEFu)&&a.spc.stopped==(opcode==0xFFu));
  sameTimers(a,b);
  assert(a.spcExecutedCycles==(opcode==0xEFu?3u:2u));
  const unsigned cycles=(unsigned)(((std::uint64_t)total*1024000ull)/21477272ull);
  // The instruction costs cycles too; prescalers advance for the entire elapsed interval.
  for(int i=0;i<3;++i){
    const unsigned period=(i==2?16u:128u);
    assert((unsigned)a.spc.timerDiv[i]==cycles%period);
    const unsigned scalerTicks=cycles/period;
    const unsigned threshold=target?target:256;
    assert((unsigned)a.spc.timerStage[i]==(scalerTicks%threshold));
    assert((unsigned)a.spc.timerOut[i]==((scalerTicks/threshold)&15u));
  }
  ++cases;
 }
 // Prescaler continues while the timer is off, then resumes from its existing phase.
 for(int timer=0;timer<3;++timer){
  ApuBridge a;config(a,0xFFu,1);
  a.spcWrite(0xF1,0);a.tickMasterCycles(6710u);
  assert(a.spc.timerStage[timer]==0 && a.spc.timerOut[timer]==0);
  const int divBefore=a.spc.timerDiv[timer];
  assert(divBefore>0);
  a.spcWrite(0xF1,(std::uint8_t)(1u<<timer));
  assert(a.spc.timerDiv[timer]==divBefore);
  assert(a.spc.timerStage[timer]==0&&a.spc.timerOut[timer]==0);
  ++cases;
 }
 // Legacy is still strictly opt-in unchanged for halted SPC timers.
 envProfile("legacy");
 for(unsigned opcode:{0xEFu,0xFFu}){
  ApuBridge a;config(a,opcode,1);a.tickMasterCycles(10000);
  const int div=a.spc.timerDiv[0];a.tickMasterCycles(10000);
  assert(a.spc.timerDiv[0]==div);
  ++cases;
 }
 envProfile("");
 std::cout<<"SPC_HALTED_TIMERS_V043639_PASS scenarios="<<cases
          <<" clocks=batch_invariant targets=zero/1/3/255 registers=read_write legacy=preserved\n";
}
`);
assert.ok(files['src/runtime.hpp'].includes('forja65AdvanceHaltedSpcTimers'));
console.log('SPC_HALTED_TIMERS_BUILD_V043639_PASS');
