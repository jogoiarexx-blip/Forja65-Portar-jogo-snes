#pragma once
#include "generated.hpp"
struct ForjaScpuAotHooks {
 bool(*step)(CpuState&,SnesRuntime&,std::uint32_t,const std::uint8_t[4],unsigned){};
 const char*romHash{};
};
inline ForjaScpuAotHooks forja65_scpu_aot{};
inline void forja65_scpu_aot_start(SnesRuntime&hw){
 if(forja65_scpu_aot.step&&(!forja65_scpu_aot.romHash||hw.cartHashHex()!=forja65_scpu_aot.romHash))
  throw std::runtime_error("SCPU observed AOT ROM fingerprint mismatch");
}
inline bool forja65_scpu_aot_step(CpuState&cpu,SnesRuntime&hw,std::uint32_t pc){
 if(!forja65_scpu_aot.step)return false;
 // Only side-effect-free ROM/WRAM code fetches; never treat MMIO as code.
 std::uint8_t bytes[4]{};unsigned available=0;
 for(unsigned k=0;k<4;k++){
  const auto address=(pc&0xff0000u)|((pc+k)&65535u);
  if(hw.peekRomOffset(hw.romOffset(address),bytes[k])){++available;continue;}
  auto off=hw.wramOffset(address);
  if(off==std::size_t(-1)||off>=hw.ram.size())break;
  bytes[k]=hw.ram[off];++available;
 }
 return forja65_scpu_aot.step(cpu,hw,pc,bytes,available);
}
