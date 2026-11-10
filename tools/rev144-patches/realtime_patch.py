"""REV144 (tempo real no Windows): 
 1) timeBeginPeriod(1): sem isso o Sleep/sleep_until do Windows tem resolucao de ~15,6 ms; o ritmo de 60 Hz virava
    quadros de 15,6/31,2 ms (jogo lento e irregular) e o audio esvaziava (picotado/acelerado).
 2) Com audio ao vivo, o relogio do audio comanda o ritmo (fila de 4 blocos de 512 amostras = 64 ms); o ritmo por
    tempo de parede fica so para quando nao ha audio. Dois relogios brigando (60,0 Hz no video x 32 kHz no DAC) faziam
    a fila do audio esvaziar aos poucos. FORJA65_AUDIO_PACING=0 volta ao antigo; FORJA65_AUDIO_LATENCY_BLOCKS=2..12.
 3) Sem audio: ritmo na frequencia real do SNES (NTSC 21.477.272/357.366 = 60,0988 Hz; PAL 50,007 Hz), com espera
    hibrida (dorme ate 2 ms antes e termina com yield) em vez de 60,0/50,0.
 4) traceWramWrite lia 2 variaveis de ambiente a cada escrita na WRAM (getenv = ~7% do tempo do port). Agora le uma
    vez por quadro."""
import json,sys
# ---- PcmAudioOutput (cabecalho; no core e uma string JSON) ----
H=[
("  bool syncLive{true},drainLive{true};",
 "  bool syncLive{true},drainLive{true};\n  // REV144: com audio ao vivo, o DAC comanda o ritmo do jogo (fila curta).\n  bool audioPacing{true};unsigned maxQueued{4};\n  bool pacesHost()const{return liveReady&&syncLive&&audioPacing;}"),
("    }else gainPercent=100u;",
 "    }else gainPercent=100u;\n    audioPacing=!(std::getenv(\"FORJA65_AUDIO_PACING\")&&std::string(std::getenv(\"FORJA65_AUDIO_PACING\"))==\"0\");\n    if(const char*q=std::getenv(\"FORJA65_AUDIO_LATENCY_BLOCKS\")){const long n=std::strtol(q,nullptr,10);maxQueued=(n>=2&&n<=12)?unsigned(n):4u;}else maxQueued=4u;"),
("        liveReady=true;\n",
 "        liveReady=true;if(!timerRaised){timeBeginPeriod(1);timerRaised=true;} // REV144: Sleep(1) de 1 ms\n"),
("    waveOutClose(device);device=nullptr;nextSlot=0;",
 "    waveOutClose(device);device=nullptr;nextSlot=0;\n    if(timerRaised){timeEndPeriod(1);timerRaised=false;}"),
("  unsigned nextSlot{};",
 "  unsigned nextSlot{};\n  bool timerRaised{};\n  unsigned queuedBlocks()const{unsigned n=0;for(const auto&b:buffers)if(b.submitted&&!(b.hdr.dwFlags&WHDR_DONE))++n;return n;}"),
("      chosen=findFreeBuffer();\n      // A fast CPU",
 "      // REV144: mantem no maximo maxQueued blocos na fila (latencia ~64 ms); o DAC dita o ritmo.\n      if(syncLive&&audioPacing){for(unsigned waited=0;waited<300&&queuedBlocks()>=maxQueued;waited++){Sleep(1);++bufferWaitMs;}}\n      chosen=findFreeBuffer();\n      // A fast CPU"),
]
# ---- runtime (no core e codigo dentro de template literal) ----
R=[
("double hostRefreshHz()const{return isPalRegion(regionCode)?50.0:60.0;}",
 "double hostRefreshHz()const{return isPalRegion(regionCode)?21281370.0/(312.0*1364.0):21477272.0/357366.0;} // REV144: frequencia real do SNES"),
("void paceHostFrame(){if(headless||envFlag(\"FORJA65_UNCAPPED\"))return;",
 "void paceHostFrame(){if(headless||envFlag(\"FORJA65_UNCAPPED\"))return;if(apu.pcmOutput&&apu.pcmOutput->pacesHost())return; // REV144: o audio comanda\n"),
("std::this_thread::sleep_until(nextPresent);}",
 "{const auto early=nextPresent-std::chrono::milliseconds(2);if(std::chrono::steady_clock::now()<early)std::this_thread::sleep_until(early);while(std::chrono::steady_clock::now()<nextPresent)std::this_thread::yield();}}"),
("void initWindow(){hinst=GetModuleHandle(nullptr);",
 "void initWindow(){timeBeginPeriod(1);hinst=GetModuleHandle(nullptr);"),
("void shutdownWindow(){if(hwnd&&IsWindow(hwnd))DestroyWindow(hwnd);hwnd=nullptr;}",
 "void shutdownWindow(){if(hwnd&&IsWindow(hwnd))DestroyWindow(hwnd);hwnd=nullptr;timeEndPeriod(1);}"),
("    const char*path=std::getenv(\"FORJA65_WRAM_WRITE_CSV\");\n    const char*filter=std::getenv(\"FORJA65_WRAM_WRITE_ADDRS\");\n",
 "    // REV144: getenv a cada escrita custava ~7% do port; as variaveis sao relidas uma vez por quadro.\n    if(wramTraceEnvFrame!=frameCounter){wramTraceEnvFrame=frameCounter;wramTracePath=std::getenv(\"FORJA65_WRAM_WRITE_CSV\");wramTraceFilter=std::getenv(\"FORJA65_WRAM_WRITE_ADDRS\");}\n    const char*path=wramTracePath;\n    const char*filter=wramTraceFilter;\n"),
("  std::uint64_t wramWriteTraceCount{};",
 "  std::uint64_t wramWriteTraceCount{};std::uint64_t wramTraceEnvFrame{~0ull};const char*wramTracePath{};const char*wramTraceFilter{};"),
]
MARK='FORJA65_AUDIO_PACING'
def apply(t,pairs,enc=lambda s:s,only_present=False):
    for a,b in pairs:
        ea,eb=enc(a),enc(b)
        c=t.count(ea)
        if c==0 and only_present: continue
        assert c==1,(a[:70],c); t=t.replace(ea,eb,1)
    return t
def patch_cpp(t,is_header=False):
    if MARK in t: return t
    t=apply(t,H)
    if not is_header:t=apply(t,R)
    return t
def patch_core(t):
    if MARK in t: return t
    j=lambda s:json.dumps(s)[1:-1]
    i=t.index('const forja65PcmAudioHeader="'); e=t.index('\n',i); line=t[i:e]
    line=apply(line,H,j); t=t[:i]+line+t[e:]
    esc=lambda s:s.replace('\\','\\\\')
    return apply(t,R,esc)
if __name__=='__main__':
    for p in sys.argv[1:]:
        s=open(p).read()
        n=patch_core(s) if p.endswith('.js') else patch_cpp(s,p.endswith('pcm_audio_output.hpp'))
        with open(p,'w') as f: f.write(n)
        print(p,'ok')
