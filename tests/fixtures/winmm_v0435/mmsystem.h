#pragma once
#include "windows.h"
inline unsigned mockOutputRate{};
inline MMRESULT waveOutOpen(HWAVEOUT* d,unsigned,const WAVEFORMATEX*fmt,std::uintptr_t,std::uintptr_t,unsigned){mockOutputRate=fmt->nSamplesPerSec;*d=reinterpret_cast<HWAVEOUT>(1);return 0;}
inline MMRESULT waveOutPrepareHeader(HWAVEOUT,WAVEHDR* h,unsigned){h->dwFlags=WHDR_DONE;return 0;}
inline MMRESULT waveOutWrite(HWAVEOUT,WAVEHDR* h,unsigned){h->dwFlags&=~WHDR_DONE;mockHeaders[mockCount++]=h;return 0;}
inline MMRESULT waveOutReset(HWAVEOUT){for(unsigned i=0;i<mockCount;i++)mockHeaders[i]->dwFlags|=WHDR_DONE;mockCount=0;return 0;}
inline MMRESULT waveOutUnprepareHeader(HWAVEOUT,WAVEHDR*,unsigned){return 0;}
inline MMRESULT waveOutClose(HWAVEOUT){return 0;}
inline unsigned mockTimerPeriods{};
inline MMRESULT timeBeginPeriod(unsigned){++mockTimerPeriods;return 0;}
inline MMRESULT timeEndPeriod(unsigned){if(mockTimerPeriods)--mockTimerPeriods;return 0;}
