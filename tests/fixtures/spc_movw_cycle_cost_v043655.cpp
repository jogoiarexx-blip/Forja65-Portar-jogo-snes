#include "runtime.hpp"
#include <iostream>
int main(){ApuBridge a;a.spc.control=0;a.spc.pc=0x300;a.spc.psw=0;a.spc.ram[0x300]=0xda;a.spc.ram[0x301]=0xf3;a.spc.setA(0x20);a.spc.setY(0x77);const int cost=forja65SpcStep(a);std::cout<<"MOVW_DA_SPC_CYCLES="<<cost<<"\n";}
