#pragma once
// Optional ROM-bound translated secondary CPU instructions.
struct ForjaSa1AotHooks {
 bool(*step)(CpuState&,SnesRuntime&,std::uint32_t,const std::uint8_t[4]){};
 const char*romHash{};
};
extern ForjaSa1AotHooks forja65_sa1_aot;
