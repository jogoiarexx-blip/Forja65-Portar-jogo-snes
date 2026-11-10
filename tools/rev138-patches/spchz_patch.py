"""REV138: relogio do SPC700 (perfil reference/NTSC exato) = 32040 Hz x 32 = 1.025.280 Hz, como bsnes e Snes9x
(valor medido em consoles). FORJA65_SPC_HZ=1024000 volta ao nominal antigo."""
HELP=('// REV138: relogio do SPC700 no perfil NTSC exato. Antes era o nominal 1.024.000 Hz; bsnes e Snes9x usam\n'
      '// 32040 x 32 = 1.025.280 Hz (media medida em consoles). Com o nominal o envio de musica do SMW atrasava\n'
      '// ~1 linha por quadro e o jogo perdia um quadro (lag) na tela de titulo. FORJA65_SPC_HZ=n escolhe outro valor.\n'
      'inline std::int64_t forja65SpcHz(){static const std::int64_t v=[](){const char*e=std::getenv("FORJA65_SPC_HZ");'
      'if(e&&*e){const long long n=std::atoll(e);if(n>=900000&&n<=1100000)return (std::int64_t)n;}return (std::int64_t)1025280;}();return v;}\n')
REP=[("inline bool forja65SpcSemanticsDefault(){",HELP+"inline bool forja65SpcSemanticsDefault(){"),
     ("constexpr std::int64_t masterHz=21477272,spcHz=1024000;","constexpr std::int64_t masterHz=21477272;const std::int64_t spcHz=forja65SpcHz();"),
     ("(s.ntscSpcClock?1024000ull:1ull)","(s.ntscSpcClock?(std::uint64_t)forja65SpcHz():1ull)")]
def patch(t):
    if 'forja65SpcHz' in t: return t
    for a,b in REP:
        assert t.count(a)==1,(a[:40],t.count(a)); t=t.replace(a,b,1)
    return t
if __name__=='__main__':
    import sys; p=sys.argv[1]; t=patch(open(p).read()); open(p,'w').write(t); print('ok')
