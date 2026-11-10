#include "runtime.hpp"
#include <fstream>
#include <string>
int main() {
    SnesRuntime hw;
    hw.cart.resize(0x8000);
    hw.romLogicalSize=hw.cart.size();
    hw.busClockTrace.start("runtime.csv");
    hw.lastInstructionPc=0x808000u;
    hw.write8(0x7e0020u,0x52u);
    hw.advanceCpuMasterCycles(12u);
    if(hw.read(0x7e0020u)!=0x52u) return 2;
    hw.busClockTrace.close();
    std::ifstream in("runtime.csv");
    std::string line, all;
    while(std::getline(in,line)) all+=line+'\n';
    return all.find("1,12,0,8421376,read,CPU,8257568,82,unknown")!=std::string::npos?0:3;
}
