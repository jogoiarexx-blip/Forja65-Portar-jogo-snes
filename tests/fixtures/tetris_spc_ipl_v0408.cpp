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

static bool untilPorts(ApuBridge& a, unsigned p0, unsigned v0, unsigned p1, unsigned v1, int limit=200000){
    for(int i=0;i<limit;++i){
        if(a.read(p0)==v0 && a.read(p1)==v1)return true;
        forja65SpcStep(a);
    }
    return false;
}
static bool untilPort(ApuBridge& a, unsigned port, unsigned value, int limit=200000){
    for(int i=0;i<limit;++i){
        if(a.read(port)==value)return true;
        forja65SpcStep(a);
    }
    return false;
}
static void checkHandshake(bool accurate){
    ApuBridge a;
    a.tracePorts=true;
    a.accurateSpcTiming=accurate;
    a.correctedSpcSemantics=true;
    assert(untilPorts(a,0,0xAA,1,0xBB));
    // Verify eight unidirectional latches, not a shared readable/writable byte.
    assert(a.spcRead(0xF4)==0);
    assert(a.spcRead(0xF5)==0);
    a.write(2,0x00);a.write(3,0x02);a.write(1,0x01);a.write(0,0xCC);
    assert(a.read(0)==0xAA && a.spcRead(0xF4)==0xCC);
    assert(untilPort(a,0,0xCC));
    a.write(1,0xE8);a.write(0,0);
    assert(untilPort(a,0,0));
    a.write(1,0x34);a.write(0,1);
    assert(untilPort(a,0,1));
    a.write(2,0);a.write(3,2);a.write(1,0);a.write(0,3);
    assert(untilPort(a,0,3));
    bool atEntry=false;
    for(int i=0;i<100;++i){if(a.spc.pc==0x0200){atEntry=true;break;}forja65SpcStep(a);}
    assert(atEntry);
    assert(a.spc.ram[0x0200]==0xE8 && a.spc.ram[0x0201]==0x34);
    assert(a.spc.portIn[0]==3 && a.spc.portOut[0]==3);
    bool sawReadyAA=false,sawReadyBB=false,sawCPUcc=false,sawACKcc=false;
    unsigned firstCpuCC=0,firstSpcCC=0;
    for(const auto &e:a.portEvents){
        if(e.side=='S'&&e.port==0&&e.value==0xAA)sawReadyAA=true;
        if(e.side=='S'&&e.port==1&&e.value==0xBB)sawReadyBB=true;
        if(e.side=='C'&&e.port==0&&e.value==0xCC){sawCPUcc=true;firstCpuCC=(unsigned)e.sequence;}
        if(e.side=='S'&&e.port==0&&e.value==0xCC){sawACKcc=true;firstSpcCC=(unsigned)e.sequence;}
    }
    assert(sawReadyAA&&sawReadyBB&&sawCPUcc&&sawACKcc&&firstCpuCC<firstSpcCC);
    assert(a.portEventsDropped==0);
    const std::string name=accurate?"spc-ipl-accurate.csv":"spc-ipl-stable.csv";
    assert(a.savePortTrace(name));
    std::ifstream input(name);
    std::string header;
    std::getline(input,header);
    assert(header=="sequence,master_cycles,spc_cycles,spc_pc,side,port,value,polls,last_master_cycles,cpu_pc,last_cpu_pc");
    input.close();std::filesystem::remove(name);
}
static void checkRationalClock(){
    ApuBridge a;
    a.accurateSpcTiming=true;
    a.ntscSpcClock=true;
    a.spc.control=0; a.spc.pc=0x0200;
    a.tickMasterCycles(21478); // Slightly over 1 ms of NTSC S-CPU master ticks.
    assert(a.spcExecutedCycles==1024); // 512 two-cycle NOPs at 1.024 MHz.
    assert(a.ntscCycleCredit<2*21477272LL);
    assert(a.spcMasterRemainder==0); // Old integer-ratio mode was not used.
    const auto before=a.spcExecutedCycles;
    a.tickMasterCycles(0);
    assert(a.spcExecutedCycles==before);
    a.tickMasterCycles(21478);
    assert(a.spcExecutedCycles==2048);
}
int main(){
    checkHandshake(false);
    checkHandshake(true);
    checkRationalClock();
    std::cout<<"SPC_IPL_HANDSHAKE_PASS stable_and_accurate=1 ports=bidirectional_latches transfer=2_bytes clock=ntsc_rational\n";
}
