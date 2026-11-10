#pragma once
#include <cstdlib>
#include <utility>
inline void forja65SetEnvironment(const char* k,const char* v){
#ifdef _WIN32
_putenv_s(k,v);
#else
if(v&&*v)setenv(k,v,1);else unsetenv(k);
#endif
}
inline void forja65ApplyStartupDefaults(){for(auto p:{std::pair{"FORJA65_SPC_PROFILE","reference"},std::pair{"FORJA65_AUDIO_MODE","native"},std::pair{"FORJA65_DMA_MODE","native"}}){const auto* v=std::getenv(p.first);if(!v||!*v)forja65SetEnvironment(p.first,p.second);}}
