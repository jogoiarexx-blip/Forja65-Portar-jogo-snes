#pragma once
#include <vector>
#include <cstdint>
struct SettingsStub{bool MSU1=false;int InterpolationMethod=2;bool SeparateEchoBuffer=false;};
inline SettingsStub Settings;
inline void S9xMSU1Generate(int){}
struct Resampler{std::vector<short> out;void push_sample(short l,short r){out.push_back(l);out.push_back(r);}};
