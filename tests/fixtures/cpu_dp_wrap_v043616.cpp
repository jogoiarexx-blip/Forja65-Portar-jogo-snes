#include "runtime.hpp"
#include <iostream>
#include <memory>
static int failures=0;
static void check(bool ok,const char*label){if(!ok){std::cerr<<"FAIL "<<label<<'\n';++failures;}}
int main(){auto runtime=std::make_unique<SnesRuntime>();auto& hw=*runtime;CpuState c;c.e=true;c.d=0x0300;c.x=0x20;c.y=0x20;c.db=0x7e;
 check(c.address("dpx",0xf0)==0x0310,"emulation DP,X page wrap");
 check(c.address("dpy",0xf0)==0x0310,"emulation DP,Y page wrap");
 hw.ram[0x3ff]=0x34;hw.ram[0x300]=0x12;hw.ram[0x400]=0x56;
 check(c.addressDpIndirect(hw,0xff)==0x7e1234,"(dp) pointer high wraps");
 check(c.addressDpIndirectY(hw,0xff)==0x7e1254,"(dp),Y pointer high wraps");
 c.x=0x0f;check(c.addressDpIndirectX(hw,0xf0)==0x7e1234,"(dp,X) pointer high wraps");
 c.x=0x20;hw.ram[0x310]=0x78;hw.ram[0x311]=0x12;hw.ram[0x410]=0xab;hw.ram[0x411]=0x56;
 check(c.addressDpIndirectX(hw,0xf0)==0x7e1278,"(dp,X) index wraps");
 hw.ram[0x401]=0x7f;check(c.addressDpLong(hw,0xff)==0x7f5634,"[dp] must cross page");
 check(c.addressDpLongY(hw,0xff)==0x7f5654,"[dp],Y must cross page");
 check(hw.readW(c.address("dp",0xff),16)==0x5634,"PEI operand must cross page");
 c.e=false;c.x=0x20;check(c.address("dpx",0xf0)==0x0410,"native DP,X crosses page");
 check(c.addressDpIndirect(hw,0xff)==0x7e5634,"native pointer crosses page");
 c.e=true;c.d=0x0301;check(c.address("dpx",0xf0)==0x0411,"unaligned emulation DP,X crosses page");
 check(c.addressDpIndirect(hw,0xfe)==0x7e5634,"unaligned emulation pointer crosses page");
 c.e=false;c.d=0xffff;c.x=2;check(c.address("dpx",0)==1,"native DP wraps bank zero");
 c.d=0;c.db=0xff;c.y=2;hw.ram[0x20]=0xff;hw.ram[0x21]=0xff;check(c.addressDpIndirectY(hw,0x20)==1,"indexed data bank carry wraps 24 bits");
 if(failures)return 1;
 std::cout<<"CPU_DP_WRAP_V043616_PASS cases=15\n";return 0;
}
