#include "runtime.hpp"
#include <memory>
#include <stdexcept>
#include <iostream>
static void check(bool x){if(!x)throw std::runtime_error("SA1 runtime safety regression");}
int main(){
 auto hp=std::make_unique<SnesRuntime>();auto&h=*hp;h.mapper=MapperKind::SA1;h.cartChip=CartChip::SA1;h.cart.resize(8388608);h.romLogicalSize=h.cart.size();h.sram.resize(32768);h.sramPath="secondary-only.srm";
 auto&b=h.sa1Board();b.reg[0x27]=128;b.write(true,0x400100,0x9b);check(!h.sramDirty&&b.bwDirty);h.saveSram();
 std::ifstream in(h.sramPath,std::ios::binary);std::vector<unsigned char> saved((std::istreambuf_iterator<char>(in)),{});check(saved.size()==32768&&saved[0x100]==0x9b);
 h.write8(0x2220,0x83);CpuState c;bool rejected=false;try{h.traceInstruction(0x8000,c,0xea);}catch(const std::runtime_error&e){rejected=std::string(e.what()).find("MMC")!=std::string::npos;}check(rejected);
 std::cout<<"REV203_SA1_RUNTIME_SAFETY_PASS\n";
}
