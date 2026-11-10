#include "runtime.hpp"
#include <iostream>
#include <vector>
int main(){
 SpcDsp d;d.hardwareVolumeScaling=true;d.hardwareEnvelopeTiming=false;d.hardwareKeyTiming=false;
 d.interpolation=SpcDsp::Interpolation::Linear;d.regs[0x0c]=0xff;d.regs[0x1c]=0xff;
 auto&v=d.voice[0];v.active=true;v.blockPos=0;v.phase=0;v.decoded[0]=v.decoded[1]=256;
 d.regs[0x00]=1;d.regs[0x01]=1;d.regs[0x07]=127;
 std::vector<std::uint8_t>ram(65536,0);
 auto pcm=d.renderSample(ram);
 std::cout<<"FINAL_MIX_ACTUAL="<<pcm[0]<<" expected=-1\n";
 return (pcm[0]==-1&&pcm[1]==-1)?0:1;
}
