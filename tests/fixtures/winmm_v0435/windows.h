#pragma once
#include <cstdint>
using MMRESULT=unsigned;
using LPSTR=char*;
using HWAVEOUT=void*;
#define NOMINMAX
#define CALLBACK_NULL 0
#define WAVE_FORMAT_PCM 1
#define WAVE_MAPPER 0
#define MMSYSERR_NOERROR 0
#define WHDR_DONE 1
struct WAVEHDR {LPSTR lpData{}; unsigned dwBufferLength{}; unsigned dwFlags{};};
struct WAVEFORMATEX{unsigned short wFormatTag{},nChannels{};unsigned nSamplesPerSec{};unsigned nAvgBytesPerSec{};unsigned short nBlockAlign{},wBitsPerSample{};};
inline WAVEHDR* mockHeaders[32]{};
inline unsigned mockCount{};
inline void Sleep(unsigned){if(mockCount){mockHeaders[0]->dwFlags|=WHDR_DONE;for(unsigned i=1;i<mockCount;i++)mockHeaders[i-1]=mockHeaders[i];mockCount--;}}
