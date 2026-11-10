// ONLY for the synthetic fixture in native-hooks-framework-regression.js.
// These addresses are examples, not game-specific core rules.
#include "generated.hpp"
static unsigned writeShort(CpuState&c,SnesRuntime&h){c.setA(0x12,8);h.ram[0x10]=0x12;return 82;}
static unsigned writeLong(CpuState&c,SnesRuntime&h){c.setA(0x34,8);h.ram[0x11]=0x34;return 84;}
void forja65_register_native_hooks(SnesRuntime&h){
 h.registerNativeHook({0x8020,writeShort,nullptr,1,1,1});
 h.registerNativeHook({0x8030,writeLong,nullptr,1,1,1});
}
