#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>

static ApuBridge makeSpc(std::initializer_list<std::uint8_t> program){
    ApuBridge a;
    a.spc.control=0;
    a.spc.pc=0x0200;
    a.accurateSpcTiming=true;
    a.strictSpcScheduler=true;
    std::uint16_t pc=0x0200;
    for(const auto b:program)a.spc.ram[pc++]=b;
    return a;
}
int main(){
    // Predicting the dynamic cost must not read/clear timers or mutate state.
    for(unsigned opcode=0;opcode<256;++opcode){
        for(const unsigned flags:{0u,1u,2u,0x40u,0x80u,0xFFu}){
            auto a=makeSpc({(std::uint8_t)opcode,0xFD,0x00,0x00});
            a.spc.psw=(std::uint8_t)flags;
            a.spc.x=1;a.spc.setA(3);a.spc.setY(2);
            a.spc.ram[0xFD]=0x55;a.spc.timerOut[0]=7;
            const auto saved=a.spc;
            const unsigned predicted=forja65SpcPredictCycles(a);
            assert(a.spc.pc==saved.pc);
            assert(a.spc.timerOut[0]==7);
            const unsigned actual=(unsigned)forja65SpcStep(a);
            if(predicted!=actual){std::cerr<<"opcode="<<std::hex<<opcode<<" flags="<<flags<<" predicted="<<std::dec<<predicted<<" actual="<<actual<<"\n";return 1;}
        }
    }
    // No visible APU write until enough time to retire the full instruction.
    {
        auto a=makeSpc({0x8F,0xCC,0xF4,0x00}); // MOV $F4,#$CC (5 cycles)
        const unsigned cost=forja65SpcPredictCycles(a);
        assert(cost==5);
        a.tickMasterCycles((cost-1)*21);
        assert(a.spc.portOut[0]==0 && a.spc.pc==0x0200);
        a.tickMasterCycles(21);
        assert(a.spc.portOut[0]==0xCC && a.spc.pc==0x0203);
    }
    // Branches must wait for base+two cycles when taken, not just base.
    {
        auto a=makeSpc({0xD0,0x00,0x00});
        a.spc.psw=0;
        assert(forja65SpcPredictCycles(a)==4);
        a.tickMasterCycles(63);
        assert(a.spc.pc==0x0200);
        a.tickMasterCycles(21);
        assert(a.spc.pc==0x0202);
    }
    // $F1 timer bits retain timer state on repeated writes; reset only on 0->1.
    {
        auto a=makeSpc({});
        a.spc.timerStage[2]=7;a.spc.timerOut[2]=4;a.spc.timerDiv[2]=11;
        a.spc.timersOn[2]=true;
        a.spcWrite(0xF1,0x04);
        assert(a.spc.timerStage[2]==7 && a.spc.timerOut[2]==4);
        assert(a.spc.timerDiv[2]==11); // stage-1 prescaler remains free-running
    }
    // Original stable scheduler remains unchanged and does not activate strict.
    {
        auto a=makeSpc({0x8F,0xCC,0xF4,0x00});
        a.strictSpcScheduler=false;
        a.tickMasterCycles(42);
        assert(a.spc.portOut[0]==0xCC); // kept only as legacy/diagnostic behavior
    }
    std::cout<<"SPC_STRICT_SCHEDULER_PASS opcodes=256*6 retire=exact timers=edge-only stable=preserved\n";
}
