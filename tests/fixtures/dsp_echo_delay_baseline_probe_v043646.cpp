#include "runtime.hpp"
#include <iostream>
#include <vector>
int main(){
 std::vector<std::uint8_t> ram(65536,0);
 SpcDsp d;d.hardwareEchoFir=true;d.echoRamWritesAllowed=false;
 d.writeReg(0x4d,1,ram);d.writeReg(0x6d,0x20,ram);d.writeReg(0x7d,1,ram);
 d.processEcho(ram,0,0);
 d.writeReg(0x7d,2,ram);
 std::cout<<"ECHO_OFFSET_AFTER_EDL_WRITE="<<d.echoPosition<<"\n";
 d.writeReg(0x6d,0x40,ram);
 std::cout<<"ECHO_OFFSET_AFTER_ESA_WRITE="<<d.echoPosition<<"\n";
}
