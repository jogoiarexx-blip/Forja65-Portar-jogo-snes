"""REV137: FORJA65_IRQ_LOG=arquivo registra L(atch IRQ)/B(loqueado por I)/S(ervico)/N(MI)/D(MA inicio)/E(DMA fim) com quadro, linha e ciclo."""
REP=[
 ("void latchIrqStatus(){irqComparatorValid=true;","static FILE* irqLogFile(){static FILE*f=[](){const char*p=std::getenv(\"FORJA65_IRQ_LOG\");return (p&&*p)?std::fopen(p,\"w\"):(FILE*)nullptr;}();return f;}\n  bool irqLogBlocked{};\n  void latchIrqStatus(){if(auto*f=irqLogFile()){std::fprintf(f,\"L %llu %u %u %06x\\n\",(unsigned long long)frameCounter,currentScanline,currentMasterCycle,lastInstructionPc);}irqLogBlocked=false;irqComparatorValid=true;"),
 ("if(cpuIrqInterruptPending&&!cpu.i){irqServiceCount++;","if(cpuIrqInterruptPending&&cpu.i&&!irqLogBlocked){irqLogBlocked=true;if(auto*f=irqLogFile())std::fprintf(f,\"B %llu %u %u %06x\\n\",(unsigned long long)frameCounter,currentScanline,currentMasterCycle,resumePc);}\n    if(cpuIrqInterruptPending&&!cpu.i){if(auto*f=irqLogFile())std::fprintf(f,\"S %llu %u %u %06x\\n\",(unsigned long long)frameCounter,currentScanline,currentMasterCycle,resumePc);irqServiceCount++;"),
 ("void executeDma(std::uint8_t mask){","void executeDma(std::uint8_t mask){if(auto*f=irqLogFile())std::fprintf(f,\"D %llu %u %u %06x m=%02x n0=%u\\n\",(unsigned long long)frameCounter,currentScanline,currentMasterCycle,lastInstructionPc,mask,(unsigned)dma[0].das);struct DmaEndLog{SnesRuntime*h;~DmaEndLog(){if(auto*f=irqLogFile())std::fprintf(f,\"E %llu %u %u\\n\",(unsigned long long)h->frameCounter,h->currentScanline,h->currentMasterCycle);}}dmaEndLog{this};"),
 ("if(cpuNmiInterruptPending){cpuNmiInterruptPending=false;","if(cpuNmiInterruptPending){cpuNmiInterruptPending=false;if(auto*f=irqLogFile())std::fprintf(f,\"N %llu %u %u %06x\\n\",(unsigned long long)frameCounter,currentScanline,currentMasterCycle,resumePc);"),
]
def patch(s):
    if 'irqLogFile()' in s: return s
    for a,b in REP:
        if a not in s: raise SystemExit('ancora ausente: '+a[:50])
        s=s.replace(a,b,1)
    return s
if __name__=='__main__':
    import sys; p=sys.argv[1]; t=patch(open(p).read()); open(p,'w').write(t); print('ok')
