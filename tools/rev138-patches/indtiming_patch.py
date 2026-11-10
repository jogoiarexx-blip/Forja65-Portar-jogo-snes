"""REV138: ciclos de acesso a dados nos modos indiretos ((dp), (dp,X), (dp),Y, [dp], [dp],Y, (sr,S),Y).
O emissor passava NO_TIMING_ADDR (o endereco final so e conhecido depois de ler o ponteiro), entao a leitura/escrita
em ROM lenta ou WRAM custava 6 ciclos master em vez de 8. O SMW descomprime fases com LDA [$00],Y: o port terminava
o carregamento antes da referencia e ganhava um quadro. FORJA65_INDIRECT_DATA_TIMING=0 volta ao antigo."""
OLD=[
"inline std::uint32_t CpuState::addressDpIndirectX(SnesRuntime& hw,std::uint32_t q)const{std::uint16_t p=addressDpIndexed(q,x),base=readDpPointer(hw,p,true);return((std::uint32_t)db<<16)|base;}",
"inline std::uint32_t CpuState::addressDpIndirect(SnesRuntime& hw,std::uint32_t q)const{std::uint16_t p=(std::uint16_t)(d+q),base=readDpPointer(hw,p);return((std::uint32_t)db<<16)|base;}",
"inline std::uint32_t CpuState::addressDpIndirectY(SnesRuntime& hw,std::uint32_t q)const{std::uint16_t p=(std::uint16_t)(d+q),base=readDpPointer(hw,p);return(((std::uint32_t)db<<16)+base+y)&0xFFFFFFu;}",
"inline std::uint32_t CpuState::addressDpLong(SnesRuntime& hw,std::uint32_t q)const{std::uint16_t p=(std::uint16_t)(d+q);return(hw.read(p)|(hw.read((std::uint16_t)(p+1))<<8)|(hw.read((std::uint16_t)(p+2))<<16))&0xFFFFFFu;}",
"inline std::uint32_t CpuState::addressDpLongY(SnesRuntime& hw,std::uint32_t q)const{return(addressDpLong(hw,q)+y)&0xFFFFFFu;}",
"inline std::uint32_t CpuState::addressStackIndirectY(SnesRuntime& hw,std::uint32_t q)const{std::uint16_t p=(std::uint16_t)(s+q),base=forja65_read16_bank0(hw,p);return(((std::uint32_t)db<<16)+base+y)&0xFFFFFFu;}",
]
HELPER=("// REV138: cobra o acesso de dados dos modos indiretos (ver forja65-core.js, indtiming).\n"
 "inline std::uint32_t forja65IndirectData(const CpuState&c,SnesRuntime&hw,std::uint32_t a){static const bool on=[](){const char*e=std::getenv(\"FORJA65_INDIRECT_DATA_TIMING\");return !(e&&*e=='0');}();"
 "if(on){const unsigned q=hw.busMasterCycles(a);if(q>6u)hw.advanceCpuMasterCycles((q-6u)*(c.m8?1u:2u));}return a;}\n"
 "inline std::uint32_t forja65DpLongRaw(const CpuState&c,SnesRuntime& hw,std::uint32_t q){std::uint16_t p=(std::uint16_t)(c.d+q);return(hw.read(p)|(hw.read((std::uint16_t)(p+1))<<8)|(hw.read((std::uint16_t)(p+2))<<16))&0xFFFFFFu;}\n")
NEW=[
"inline std::uint32_t CpuState::addressDpIndirectX(SnesRuntime& hw,std::uint32_t q)const{std::uint16_t p=addressDpIndexed(q,x),base=readDpPointer(hw,p,true);return forja65IndirectData(*this,hw,((std::uint32_t)db<<16)|base);}",
"inline std::uint32_t CpuState::addressDpIndirect(SnesRuntime& hw,std::uint32_t q)const{std::uint16_t p=(std::uint16_t)(d+q),base=readDpPointer(hw,p);return forja65IndirectData(*this,hw,((std::uint32_t)db<<16)|base);}",
"inline std::uint32_t CpuState::addressDpIndirectY(SnesRuntime& hw,std::uint32_t q)const{std::uint16_t p=(std::uint16_t)(d+q),base=readDpPointer(hw,p);return forja65IndirectData(*this,hw,(((std::uint32_t)db<<16)+base+y)&0xFFFFFFu);}",
"inline std::uint32_t CpuState::addressDpLong(SnesRuntime& hw,std::uint32_t q)const{return forja65IndirectData(*this,hw,forja65DpLongRaw(*this,hw,q));}",
"inline std::uint32_t CpuState::addressDpLongY(SnesRuntime& hw,std::uint32_t q)const{return forja65IndirectData(*this,hw,(forja65DpLongRaw(*this,hw,q)+y)&0xFFFFFFu);}",
"inline std::uint32_t CpuState::addressStackIndirectY(SnesRuntime& hw,std::uint32_t q)const{std::uint16_t p=(std::uint16_t)(s+q),base=forja65_read16_bank0(hw,p);return forja65IndirectData(*this,hw,(((std::uint32_t)db<<16)+base+y)&0xFFFFFFu);}",
]
def patch(t):
    if 'forja65IndirectData' in t: return t
    for a in OLD: assert t.count(a)==1,(a[:70],t.count(a))
    t=t.replace(OLD[0],HELPER+OLD[0],1)
    for a,b in zip(OLD,NEW): t=t.replace(a,b,1)
    return t

if __name__=='__main__':
    import sys
    for p in sys.argv[1:]:
        s=open(p).read(); n=patch(s)
        with open(p,'w') as f: f.write(n)
        print(p,'ok')
