"""REV138: FORJA65_POWERON=snes9x (estado de ligar igual ao Snes9x) para comparacao em passo."""
FN=('  // REV138: FORJA65_POWERON=snes9x reproduz o estado de ligar do Snes9x (WRAM $55, CGRAM em degrade, VRAM/OAM zeradas)\n'
    '  // para comparar em passo com a referencia. Padrao (zero): inalterado.\n'
    '  void applyPowerOnProfile(){const auto p=envText("FORJA65_POWERON");if(p=="snes9x"){std::fill(ram.begin(),ram.end(),(std::uint8_t)0x55);'
    'std::fill(ppu.vram.begin(),ppu.vram.end(),(std::uint8_t)0);std::fill(ppu.oam.begin(),ppu.oam.end(),(std::uint8_t)0);'
    'for(unsigned c=0;c<256;c++){const unsigned r=(c&7u)<<2,g=((c>>3)&7u)<<2,b=((c>>6)&2u)<<3,w=r|(g<<5)|(b<<10);ppu.cgram[2*c]=(std::uint8_t)w;ppu.cgram[2*c+1]=(std::uint8_t)(w>>8);}}'
    'else if(!p.empty()&&p!="zero")throw std::runtime_error("FORJA65_POWERON invalido: "+p+" (use zero ou snes9x)");}\n')
REP=[("initInputTraceFromEnv();if(!headless)initWindow();}","initInputTraceFromEnv();applyPowerOnProfile();if(!headless)initWindow();}"),
     ("  SnesRuntime()=default; explicit SnesRuntime(",FN+"  SnesRuntime()=default; explicit SnesRuntime(")]
def patch(t):
    if 'applyPowerOnProfile' in t: return t
    for a,b in REP:
        assert t.count(a)==1,(a[:40],t.count(a)); t=t.replace(a,b,1)
    return t
if __name__=='__main__':
    import sys; p=sys.argv[1]; t=patch(open(p).read()); open(p,'w').write(t); print('ok')
