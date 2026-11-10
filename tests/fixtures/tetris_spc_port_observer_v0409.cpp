#include "runtime.hpp"
#include <cassert>
#include <iostream>
int main(){
  ApuBridge s; s.tracePorts=true; s.traceCpuReads=true; s.traceCpuReadChanges=true;
  s.spcWrite(0xF4,0xAA);
  assert(s.read(0)==0xAA && s.read(0)==0xAA);
  s.write(0,0xCC);assert(s.read(0)==0xAA && s.spcRead(0xF4)==0xCC);
  s.spcWrite(0xF4,0xBB);assert(s.read(0)==0xBB);
  unsigned reads=0;for(const auto&e:s.portEvents)reads+=(e.side=='Q');
  assert(reads==3 && s.cpuPortReadCounts[0]==4);
  std::cout<<"FORJA_SPC_CPU_PORT_OBSERVER_PASS\n";
}
