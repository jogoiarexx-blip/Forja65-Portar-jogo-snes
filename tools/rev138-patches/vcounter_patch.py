"""REV137: contador V (V-IRQ, $213D) alinhado ao relogio de video do port (linha do port = V-1)."""
import sys
REP=[
     ("int irqEventMasterCycle(unsigned line)const{",
      "// REV137: a linha do port e V-1 (linha 0 desenha V=1; NMI em V=225 = linha 224). V-IRQ e $213D usam o V real.\n"
      "  static bool forja65VCounterLegacy(){static const bool v=[](){const char*e=std::getenv(\"FORJA65_VCOUNTER_LEGACY\");return e&&*e=='1';}();return v;}\n"
      "  unsigned forja65VCounterOf(unsigned line)const{if(forja65VCounterLegacy())return line;const unsigned lines=isPalRegion(regionCode)?312u:262u;return (line+1u)%lines;}\n"
      "  int irqEventMasterCycle(unsigned line)const{"),
     ("if(io.vIrqEnable&&comparedLine!=(io.vtime&0x1FFu))return -1;","if(io.vIrqEnable&&forja65VCounterOf(comparedLine)!=(io.vtime&0x1FFu))return -1;"),
     ("if(line==0u&&raw>=MASTER_CYCLES_PER_SCANLINE\n         &&raw%MASTER_CYCLES_PER_SCANLINE==6u)return -1;","if(forja65VCounterOf(line)==0u&&raw>=MASTER_CYCLES_PER_SCANLINE\n         &&raw%MASTER_CYCLES_PER_SCANLINE==6u)return -1;"),
     ("if(io.vIrqEnable&&(line&0x1FFu)==(io.vtime&0x1FFu))return (int)IRQ_TRIGGER_DELAY_MC;","if(io.vIrqEnable&&forja65VCounterOf(line)==(io.vtime&0x1FFu))return (int)IRQ_TRIGGER_DELAY_MC;"),
     ("      level=comparedLine==(io.vtime&0x1FFu);","      level=forja65VCounterOf(comparedLine)==(io.vtime&0x1FFu);"),
     ("ppu.vCounter=(std::uint16_t)(currentScanline&0x1FFu);","ppu.vCounter=(std::uint16_t)(forja65VCounterOf(currentScanline)&0x1FFu);"),
     ("ppu.vCounter=(std::uint16_t)(line&0x1FFu);","ppu.vCounter=(std::uint16_t)(forja65VCounterOf(line)&0x1FFu);"),
]
def patch(s):
    if 'forja65VCounterOf(' in s: return s
    for a,b in REP:
        if a not in s: raise SystemExit('ancora ausente: '+a[:60])
        s=s.replace(a,b)
    return s
if __name__=='__main__':
    p=sys.argv[1]; s=open(p).read(); open(p,'w').write(patch(s)); print('ok')
