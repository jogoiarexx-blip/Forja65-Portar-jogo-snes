#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
int main(){
  ApuBridge a;
  a.tracePorts=true; a.traceCpuReads=true; a.traceCpuReadChanges=true;
  a.masterObserved=100;
  a.spcWrite(0xF4,0xAA);
  assert(a.read(0)==0xAA);
  a.masterObserved=110;
  assert(a.read(0)==0xAA);
  a.masterObserved=120;
  assert(a.read(1)==0); // independent run, interleaving must not discard port 0 count
  a.masterObserved=130;
  assert(a.read(0)==0xAA);
  a.spcWrite(0xF4,0xBB);
  a.masterObserved=150;
  assert(a.read(0)==0xBB);
  a.masterObserved=170;
  assert(a.read(0)==0xBB);
  assert(a.cpuPortReadCounts[0]==5 && a.cpuPortReadCounts[1]==1);
  unsigned q=0;
  for(const auto&e:a.portEvents){
    if(e.side!='Q')continue;
    ++q;
    if(e.port==0&&e.value==0xAA)assert(e.polls==3&&e.master==100&&e.lastMaster==130);
    if(e.port==1)assert(e.polls==1&&e.master==120&&e.lastMaster==120);
    if(e.port==0&&e.value==0xBB)assert(e.polls==2&&e.master==150&&e.lastMaster==170);
  }
  assert(q==3);
  assert(a.savePortTrace("poll-runs.csv"));
  std::ifstream f("poll-runs.csv");
  std::string body((std::istreambuf_iterator<char>(f)),std::istreambuf_iterator<char>());
  assert(body.find("value,polls,last_master_cycles")!=std::string::npos);
  assert(body.find("# cpu_reads=5,1,0,0")!=std::string::npos);
  f.close();std::filesystem::remove("poll-runs.csv");
  // Full read log must remain uncompressed: every Q records one poll.
  ApuBridge full;full.tracePorts=true;full.traceCpuReads=true;full.traceCpuReadChanges=false;
  full.spcWrite(0xF4,0x11);
  for(int i=0;i<4;++i)assert(full.read(0)==0x11);
  q=0;for(const auto&e:full.portEvents)if(e.side=='Q'){++q;assert(e.polls==1);}
  assert(q==4);
  // Disabled tracing must never change the hardware-visible state or allocate events.
  ApuBridge off;off.spcWrite(0xF4,0xCC);
  assert(off.read(0)==0xCC && off.portEvents.empty());
  // The bounded vector cannot be extended. Counts still reflect all queries.
  ApuBridge cap;cap.tracePorts=true;cap.traceCpuReads=true;cap.traceCpuReadChanges=false;
  for(unsigned i=0;i<32770;++i)assert(cap.read(0)==0);
  assert(cap.portEvents.size()==32768&&cap.cpuPortReadCounts[0]==32770&&cap.portEventsDropped==2);
  // New 0.4.11: keep local windows and record the original S-CPU polling PC.
  ApuBridge windowed;
  windowed.tracePorts=true;windowed.traceCpuReads=true;
  windowed.traceCpuReadChanges=true;windowed.traceCpuReadWindow=true;
  windowed.masterObserved=100;
  assert(windowed.read(0,0x808001)==0);
  windowed.masterObserved=500;
  assert(windowed.read(0,0x808005)==0);
  windowed.masterObserved=1465; // later than 1364 cycles after first read
  assert(windowed.read(0,0x808009)==0);
  windowed.spcWrite(0xF4,0x00); // even same-value SPC write is a run boundary
  windowed.masterObserved=1470;
  assert(windowed.read(0,0x80800D)==0);
  unsigned qruns=0;
  for(const auto&e:windowed.portEvents)if(e.side=='Q'){
    ++qruns;
    if(qruns==1){assert(e.polls==2);assert(e.cpuPc==0x808001);assert(e.lastCpuPc==0x808005);}
    if(qruns==2){assert(e.polls==1);assert(e.cpuPc==0x808009);}
    if(qruns==3){assert(e.polls==1);assert(e.cpuPc==0x80800D);}
  }
  assert(qruns==3);
  assert(windowed.savePortTrace("window-runs.csv"));
  {std::ifstream wf("window-runs.csv");std::string wc((std::istreambuf_iterator<char>(wf)),{});
   assert(wc.find("cpu_pc,last_cpu_pc")!=std::string::npos);}
  std::filesystem::remove("window-runs.csv");
  // Detect an invalidated run: polls must not be silently lost after a write.
  assert(windowed.cpuPortReadCounts[0]==4);
  std::cout<<"SPC_CPU_POLL_RUNS_PASS compact=3 full=4 capacity=32768\n";
}
