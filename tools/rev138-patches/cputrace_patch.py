"""REV138: trace por instrucao no proprio port (comando 'cputrace ARQ N' do modo de controle; FORJA65_CPU_TRACE=arq[:N]).
Cada linha: PC custo_em_ciclos_master linha ciclo_na_linha (antes da instrucao). Compara direto com o trace do Snes9x."""
REP=[
 ("  void advanceCpuInstruction(std::uint32_t pc,unsigned cpuCycles,unsigned fetchBytes,std::uint32_t dataAddr,unsigned dataAccesses,std::uint32_t auxAddr,unsigned auxAccesses,unsigned stackAccesses){",
  "  FILE* cpuTraceFile{}; std::uint64_t cpuTraceLeft{};\n"
  "  void openCpuTrace(const std::string&p,std::uint64_t n){if(cpuTraceFile){std::fclose(cpuTraceFile);cpuTraceFile=nullptr;}if(!p.empty()&&p!=\"off\"){cpuTraceFile=std::fopen(p.c_str(),\"w\");cpuTraceLeft=n?n:~0ull;}}\n"
  "  void advanceCpuInstruction(std::uint32_t pc,unsigned cpuCycles,unsigned fetchBytes,std::uint32_t dataAddr,unsigned dataAccesses,std::uint32_t auxAddr,unsigned auxAccesses,unsigned stackAccesses){"),
 ("    io.clockAluCpuCycles(cpuCycles);\n    advanceCpuMasterCycles(mc);\n  }",
  "    io.clockAluCpuCycles(cpuCycles);\n    if(cpuTraceFile){std::fprintf(cpuTraceFile,\"%06X %u %u %u\\n\",(unsigned)(pc&0xFFFFFFu),mc,currentScanline,currentMasterCycle);if(--cpuTraceLeft==0){std::fclose(cpuTraceFile);cpuTraceFile=nullptr;}}\n    advanceCpuMasterCycles(mc);\n  }"),
 ('if(c=="dump"){','if(c=="cputrace"){std::string p;unsigned long long n=0;in>>p>>n;openCpuTrace(p,n);std::printf("ok\\n");std::fflush(stdout);continue;}\n    if(c=="dump"){'),
]
def patch(t,js=False):
    if 'openCpuTrace' in t: return t
    for a,b in REP:
        if js:
            import json; a=json.dumps(a)[1:-1]; b=json.dumps(b)[1:-1]
        assert t.count(a)==1,(a[:60],t.count(a)); t=t.replace(a,b,1)
    return t

if __name__=='__main__':
    import sys
    for p in sys.argv[1:]:
        s=open(p).read(); n=patch(s)
        with open(p,'w') as f: f.write(n)
        print(p,'ok')
