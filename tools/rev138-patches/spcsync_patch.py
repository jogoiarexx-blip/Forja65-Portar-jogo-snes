"""REV138: (1) linha curta V=240 nos quadros impares sem entrelacamento (1360 ciclos mestres, como bsnes/Snes9x;
FORJA65_SHORTLINE=0 volta ao antigo). Sem ela o quadro do port durava em media 2 ciclos a mais e o SPC adiantava
~0,1 ciclo/quadro em relacao a CPU: a fase do tempo da musica derivava e o handshake de carga do Yoshi's Island 4
esperava 163 mil ciclos a mais. (2) comando de controle "aram PATH" (64 KiB do SPC + registradores + timers).
(3) FORJA65_SPCTRACE_INLINE=1: instrucoes do SPC700 no mesmo arquivo do cputrace (linhas "S ...")."""
import json,sys
P=[]
P.append(("inline std::int64_t forja65SpcHz(){","inline FILE* forja65SpcTraceFile=nullptr; // REV138: FORJA65_SPCTRACE_INLINE\ninline std::int64_t forja65SpcHz(){"))
P.append(("    bool branchTaken=false;\n    s.spcOpcodePc=s.spc.pc;",
 "    if(forja65SpcTraceFile)std::fprintf(forja65SpcTraceFile,\"S %04X A=%02X X=%02X Y=%02X SP=%02X P=%02X\\n\",(unsigned)s.spc.pc,(unsigned)s.spc.a(),(unsigned)s.spc.x,(unsigned)s.spc.y(),(unsigned)s.spc.sp,(unsigned)s.spc.psw);\n    bool branchTaken=false;\n    s.spcOpcodePc=s.spc.pc;"))
P.append(("cpuTraceFile=std::fopen(p.c_str(),\"w\");cpuTraceLeft=n?n:~0ull;}}",
 "cpuTraceFile=std::fopen(p.c_str(),\"w\");cpuTraceLeft=n?n:~0ull;}forja65SpcTraceFile=std::getenv(\"FORJA65_SPCTRACE_INLINE\")?cpuTraceFile:nullptr;}"))
P.append(("if(--cpuTraceLeft==0){std::fclose(cpuTraceFile);cpuTraceFile=nullptr;}}",
 "if(--cpuTraceLeft==0){std::fclose(cpuTraceFile);cpuTraceFile=nullptr;forja65SpcTraceFile=nullptr;}}"))
P.append(("  void advanceCpuMasterCycles(unsigned mc){",
"""  // REV138: em modo nao entrelacado, a linha V=240 dos quadros impares tem 1360 ciclos mestres (um ponto a menos),
  // como bsnes/Snes9x. Sem isso o SPC derivava ~0,1 ciclo por quadro em relacao a CPU. FORJA65_SHORTLINE=0 desliga.
  bool forja65ShortLine(unsigned line)const{
    static const int mode=[](){const char*e=std::getenv("FORJA65_SHORTLINE");if(e&&*e=='0')return -1;if(e&&*e=='1')return 1;return 0;}();
    if(mode<0||isPalRegion(regionCode)||ppu.interlace())return false;
    if(forja65VCounterOf(line)!=240u)return false;
    return mode==1?!interlaceField:interlaceField;
  }
  void advanceCpuMasterCycles(unsigned mc){"""))
P.append(("      unsigned step=std::min(remaining,MASTER_CYCLES_PER_SCANLINE-before);",
 "      const unsigned lineLen=forja65ShortLine(currentScanline)?MASTER_CYCLES_PER_SCANLINE-4u:MASTER_CYCLES_PER_SCANLINE; // REV138\n      unsigned step=std::min(remaining,lineLen-before);"))
P.append(("      if(target<MASTER_CYCLES_PER_SCANLINE)continue;\n      // The OBJ CHR buffer fetched in this line belongs to the NEXT line.",
 "      if(target<lineLen)continue;\n      // The OBJ CHR buffer fetched in this line belongs to the NEXT line."))
ARAM_A='    if(c=="dump"){'
ARAM_B='    if(c=="aram"){std::string p;in>>p;std::ofstream o(p,std::ios::binary);o.write((const char*)apu.spc.ram.data(),65536);std::uint8_t r[16]{(std::uint8_t)(apu.spc.pc&0xFF),(std::uint8_t)(apu.spc.pc>>8),apu.spc.a(),apu.spc.x,apu.spc.y(),apu.spc.sp,apu.spc.psw,apu.spc.timerOut[0],apu.spc.timerOut[1],apu.spc.timerOut[2],(std::uint8_t)apu.spc.timerStage[0],(std::uint8_t)apu.spc.timerStage[1],(std::uint8_t)apu.spc.timerStage[2],apu.spc.timerTarget[0],apu.spc.timerTarget[1],apu.spc.timerTarget[2]};o.write((const char*)r,16);o.close();std::printf("ok\\n");std::fflush(stdout);continue;}\n'
MARK='FORJA65_SHORTLINE'
def patch_cpp(t):
    if MARK in t: return t
    for a,b in P: assert t.count(a)==1,(a[:60],t.count(a)); t=t.replace(a,b,1)
    assert t.count(ARAM_A)==1; return t.replace(ARAM_A,ARAM_B+ARAM_A,1)
def patch_core(t):
    if MARK in t: return t
    esc=lambda s:s.replace('\\','\\\\')   # texto C++ dentro de template literal JS
    for a,b in P: assert t.count(esc(a))==1,(a[:60],t.count(esc(a))); t=t.replace(esc(a),esc(b),1)
    j=lambda s:json.dumps(s)[1:-1]          # snippet de controle e string JSON
    assert t.count(j(ARAM_A))==1; return t.replace(j(ARAM_A),j(ARAM_B)+j(ARAM_A),1)
if __name__=='__main__':
    for p in sys.argv[1:]:
        s=open(p).read(); n=patch_core(s) if p.endswith('.js') else patch_cpp(s)
        with open(p,'w') as f: f.write(n)
        print(p,'ok')
