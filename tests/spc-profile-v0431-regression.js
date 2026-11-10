'use strict';
// REV143: o padrao do SPC700 passou a 1.025.280 Hz (REV138 reintegrado). Este teste mede a aritmetica
// fracionaria do agendador no relogio nominal; fixa FORJA65_SPC_HZ=1024000.
process.env.FORJA65_SPC_HZ='1024000';
const assert=require('node:assert/strict');
const files=require('./fixtures/run_spc_probe_v0431')('spc-profile-v0431',String.raw`
void env(const char*k,const char*v){
#ifdef _WIN32
 _putenv_s(k,v);
#else
 if(v&&*v)setenv(k,v,1);else unsetenv(k);
#endif
}
void clear(){for(const char*k:{"FORJA65_SPC_PROFILE","FORJA65_SPC_TIMING","FORJA65_SPC_SCHEDULER","FORJA65_SPC_SEMANTICS","FORJA65_SPC_CLOCK"})env(k,"");}
void program(ApuBridge&s){s.spc.control=0;s.spc.pc=0x200;s.spc.ram[0x200]=0x2F;s.spc.ram[0x201]=0xFE;s.spcWrite(0xFA,3);s.spcWrite(0xFB,5);s.spcWrite(0xFC,7);s.spcWrite(0xF1,7);}
int main(){
 clear();{ApuBridge a;/* REV195: perfil reference e o padrao (antes so a semantica corrigida) */assert(a.accurateSpcTiming&&a.strictSpcScheduler&&a.correctedSpcSemantics&&a.ntscSpcClock);}env("FORJA65_SPC_TIMING","legacy");{ApuBridge a;assert(!a.accurateSpcTiming&&a.strictSpcScheduler);}clear();env("FORJA65_SPC_SEMANTICS","legacy");{ApuBridge a;assert(!a.correctedSpcSemantics);}clear();
 // Explicit profiles are complete presets, independent of inherited switches.
 env("FORJA65_SPC_PROFILE","reference");env("FORJA65_SPC_TIMING","0");env("FORJA65_SPC_SCHEDULER","0");env("FORJA65_SPC_SEMANTICS","legacy");env("FORJA65_SPC_CLOCK","legacy");
 {ApuBridge a;assert(a.accurateSpcTiming&&a.strictSpcScheduler&&a.correctedSpcSemantics&&a.ntscSpcClock);}
 env("FORJA65_SPC_PROFILE","legacy");env("FORJA65_SPC_TIMING","accurate");env("FORJA65_SPC_SCHEDULER","strict");env("FORJA65_SPC_SEMANTICS","corrected");env("FORJA65_SPC_CLOCK","exact");
 {ApuBridge a;assert(!a.accurateSpcTiming&&!a.strictSpcScheduler&&!a.correctedSpcSemantics&&!a.ntscSpcClock);}
 clear();env("FORJA65_SPC_SEMANTICS","corrected");{ApuBridge a;assert(a.correctedSpcSemantics&&a.accurateSpcTiming&&a.strictSpcScheduler&&a.ntscSpcClock);}
 env("FORJA65_SPC_PROFILE","typo");{bool rejected=false;try{ApuBridge a;(void)a;}catch(const std::runtime_error&){rejected=true;}assert(rejected);}
 clear();env("FORJA65_SPC_PROFILE","reference");
 // Predictor must remain side-effect free and agree with actual corrected costs.
 for(unsigned opcode=0;opcode<256;++opcode)for(unsigned flags:{0u,1u,2u,0x40u,0x80u,0xFFu}){
  ApuBridge a;a.spc.control=0;a.spc.pc=0x200;a.spc.ram[0x200]=(std::uint8_t)opcode;a.spc.ram[0x201]=0xFD;a.spc.ram[0x202]=0;a.spc.psw=(std::uint8_t)flags;a.spc.x=1;a.spc.setA(3);a.spc.setY(2);a.spc.timerOut[0]=7;
  const auto pc=a.spc.pc;const auto predicted=forja65SpcPredictCycles(a);assert(a.spc.pc==pc&&a.spc.timerOut[0]==7);assert(predicted==(unsigned)forja65SpcStep(a));
 }
 // MOV $F4,#$CC has five cycles: ceil(5*21477272/1024000)=105 master clocks.
 {ApuBridge a;a.spc.control=0;a.spc.pc=0x200;a.spc.ram[0x200]=0x8F;a.spc.ram[0x201]=0xCC;a.spc.ram[0x202]=0xF4;a.tickMasterCycles(104);assert(a.spc.portOut[0]==0&&a.spc.pc==0x200);a.tickMasterCycles(1);assert(a.spc.portOut[0]==0xCC&&a.spc.pc==0x203&&a.spcExecutedCycles==5);}
 // One nominal NTSC second must be independent of incoming CPU/DMA chunks.
 {ApuBridge a,b;program(a);program(b);a.tickMasterCycles(21477272u);unsigned remaining=21477272u,seq=0;while(remaining){unsigned n=std::min(remaining,1u+((seq++*7919u)%65537u));b.tickMasterCycles(n);remaining-=n;}
  assert(a.spc.pc==b.spc.pc&&a.spc.psw==b.spc.psw&&a.spcExecutedCycles==1024000u&&b.spcExecutedCycles==a.spcExecutedCycles&&a.ntscCycleCredit==0&&b.ntscCycleCredit==0);assert(a.dspFallbackSamples==32000&&b.dspFallbackSamples==32000);for(unsigned i=0;i<3;++i)assert(a.spc.timerDiv[i]==b.spc.timerDiv[i]&&a.spc.timerStage[i]==b.spc.timerStage[i]&&a.spc.timerOut[i]==b.spc.timerOut[i]);}
 // Diagnostics report effective settings, including custom mixed configurations.
 {SnesRuntime h;h.apu.uploadCount=1;assert(h.apu.saveManifest("spc.txt"));std::ifstream manifest("spc.txt");std::string meta((std::istreambuf_iterator<char>(manifest)),{});assert(meta.find("spc_profile=reference")!=std::string::npos&&meta.find("spc_backend=interpreter")!=std::string::npos);h.apu.pcmOutput->liveRequested=true;h.writeAudioReport("audio.txt");std::ifstream f("audio.txt");std::string text((std::istreambuf_iterator<char>(f)),{});assert(text.find("spc_profile=reference")!=std::string::npos&&text.find("spc_clock=ntsc_rational")!=std::string::npos&&text.find("spc_scheduler=strict")!=std::string::npos);}
 clear();std::cout<<"SPC_PROFILE_V0431_PASS reference/legacy/custom invalid=reject predictor=256*6 boundary=105mc chunks=invariant NTSC_second=1024000cycles DSP_samples=32000 diagnostic=effective\n";
}
`);
for(const name of ['RUN-WINDOWS-SPC-REFERENCE.cmd','RUN-WINDOWS-SPC-LEGACY.cmd']){
 assert(files[name],name+' must be generated');
 assert(files['BUILD-WINDOWS.cmd'].includes('copy /Y '+name+' bin\\'+name),name+' must accompany bin/game.exe');
}
