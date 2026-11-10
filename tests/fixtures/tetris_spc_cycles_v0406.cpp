#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>

static ApuBridge makeSpc(std::initializer_list<std::uint8_t> program){
    ApuBridge apu;
    apu.accurateSpcTiming=true;
    // REV195: este teste mede o agendador 'por divida' (fatias de 42 ciclos mestres) e o relogio quantizado;
    // o padrao passou a ser o agendador estrito com relogio racional, entao fixamos os dois aqui.
    apu.strictSpcScheduler=false;apu.ntscSpcClock=false;
    apu.spc.control=0; // Run test program from RAM rather than the IPL ROM.
    apu.spc.pc=0x0200;
    std::uint16_t addr=0x0200;
    for(auto b:program)apu.spc.ram[addr++]=b;
    return apu;
}
int main(){
    // Instruction lengths: MOV dp,#imm=5, CALL absolute=8, MUL YA=9, DIV YA,X=12.
    {
        auto a=makeSpc({0x8F,0x42,0x10,0x3F,0x00,0x03});
        a.spc.ram[0x300]=0xCF; a.spc.ram[0x301]=0x9E;
        assert(forja65SpcStep(a)==5 && a.spc.ram[0x10]==0x42);
        assert(forja65SpcStep(a)==8 && a.spc.pc==0x300);
        assert(forja65SpcStep(a)==9 && a.spc.pc==0x301);
        assert(forja65SpcStep(a)==12 && a.spc.pc==0x302);
    }
    // BNE: +2 cycles only when taken, including a branch displacement of zero.
    {
        auto a=makeSpc({0xD0,0x00,0xD0,0xFE});
        a.spc.psw=CZ;
        assert(forja65SpcStep(a)==2 && a.spc.pc==0x202);
        a.spc.psw=0;
        assert(forja65SpcStep(a)==4 && a.spc.pc==0x202);
    }
    // BBS and DBNZ also pay the conditional +2-cycle penalty.
    {
        auto a=makeSpc({0x03,0x20,0x00,0x6E,0x21,0x00});
        a.spc.ram[0x20]=1;
        assert(forja65SpcStep(a)==7 && a.spc.pc==0x203);
        a.spc.ram[0x21]=2;
        assert(forja65SpcStep(a)==7 && a.spc.ram[0x21]==1);
    }
    // Timers count actual SPC cycles, not four artificial cycles per opcode.
    {
        auto a=makeSpc({});
        a.spcWrite(0xFC,1); // Timer 2: prescaler of 16 CPU cycles.
        a.spcWrite(0xF1,4);
        for(int n=0;n<7;++n)assert(forja65SpcStep(a)==2);
        assert(a.spcRead(0xFF)==0);
        assert(forja65SpcStep(a)==2);
        assert(a.spcRead(0xFF)==1);
        assert(a.spcRead(0xFF)==0); // Reading clears only timer output latch.
        a.spcWrite(0xF1,0);
        for(int n=0;n<7;++n)forja65SpcStep(a); // Prescaler still runs while disabled.
        assert(a.spc.timerDiv[2]==14);
        a.spcWrite(0xF1,4);
        assert(a.spc.timerDiv[2]==14 && a.spc.timerStage[2]==0);
        forja65SpcStep(a);
        assert(a.spcRead(0xFF)==1);
    }
    // Target 0 means 256 prescaler ticks (stage-2 counter wraps naturally).
    {
        auto a=makeSpc({});
        a.spcWrite(0xFC,0);
        a.spcWrite(0xF1,4);
        for(int n=0;n<2040;++n)forja65SpcStep(a); // 4080 cycles / 16 = 255 ticks.
        assert(a.spcRead(0xFF)==0);
        for(int n=0;n<8;++n)forja65SpcStep(a);
        assert(a.spcRead(0xFF)==1);
    }
    // Scheduler carries fractional/debt cycles between main-CPU slices.
    {
        auto a=makeSpc({0x8F,0xA5,0x30,0x00});
        a.tickMasterCycles(41);
        assert(a.spc.pc==0x200 && a.spc.ram[0x30]==0);
        a.tickMasterCycles(1);
        assert(a.spc.pc==0x203 && a.spc.ram[0x30]==0xA5);
        assert(a.spcMasterRemainder==-63);
        a.tickMasterCycles(62);
        assert(a.spc.pc==0x203);
        a.tickMasterCycles(43);
        assert(a.spc.pc==0x204);
    }
    std::cout<<"SPC700_CYCLE_TIMERS_PASS cycle_table=256 branches=dynamic timer_prescaler=free_running scheduler=debt\n";
}
