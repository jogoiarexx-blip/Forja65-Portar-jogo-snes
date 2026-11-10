#!/usr/bin/env python3
"""Install additive stack access overloads for legacy Forja65 native runtimes.

Opt-in bridge. Never replaces existing stack functions. Preflight exact known
legacy signatures; fail closed for unknown layouts. No execution-equivalence
claim until the native port's regression/replay checks pass.
"""
from pathlib import Path

DECL = 'std::uint16_t peekStack16(SnesRuntime&)const;'
EXTRA = ('void push8Value(SnesRuntime&,std::uint8_t,bool full); '
         'void push16Value(SnesRuntime&,std::uint16_t,bool full); '
         'std::uint8_t pop8Value(SnesRuntime&,bool full); '
         'std::uint8_t peekStack8(SnesRuntime&,unsigned,bool full)const; '
         'std::uint16_t pop16Value(SnesRuntime&,bool full); '
         'std::uint16_t peekStack16(SnesRuntime&,bool full)const; '
         'std::uint32_t popLongReturn(SnesRuntime&);')
ANCHOR = 'inline std::uint16_t CpuState::pop16Value(SnesRuntime& hw){std::uint16_t lo=pop8Value(hw),hi=pop8Value(hw);return(std::uint16_t)(lo|(hi<<8));}'
BRIDGE = '''
// Backwards-compatible overloads for ROM-verified Forja65 CFG handlers.
// A 65C816 long-return frame is always consumed with full 16-bit S addressing,
// even if the CPU is in emulation mode at the moment of the return.
inline void CpuState::push8Value(SnesRuntime& hw,std::uint8_t v,bool full){
  if(!full){push8Value(hw,v);return;}
  hw.write(s,v,8);s=(std::uint16_t)(s-1);
}
inline void CpuState::push16Value(SnesRuntime& hw,std::uint16_t v,bool full){
  if(!full){push16Value(hw,v);return;}
  push8Value(hw,(std::uint8_t)(v>>8),true);
  push8Value(hw,(std::uint8_t)v,true);
  if(e)s=(std::uint16_t)(0x100u|(s&0xFFu));
}
inline std::uint8_t CpuState::peekStack8(SnesRuntime& hw,unsigned depth,bool full)const{
  if(!full)return peekStack8(hw,depth);
  return (std::uint8_t)hw.read((std::uint16_t)(s+depth));
}
inline std::uint16_t CpuState::peekStack16(SnesRuntime& hw,bool full)const{
  if(!full)return peekStack16(hw);
  return (std::uint16_t)(peekStack8(hw,1,true)|(std::uint16_t(peekStack8(hw,2,true))<<8));
}
inline std::uint8_t CpuState::pop8Value(SnesRuntime& hw,bool full){
  if(!full)return pop8Value(hw);
  s=(std::uint16_t)(s+1);return (std::uint8_t)hw.read(s);
}
inline std::uint16_t CpuState::pop16Value(SnesRuntime& hw,bool full){
  if(!full)return pop16Value(hw);
  const auto lo=pop8Value(hw,true),hi=pop8Value(hw,true);
  if(e)s=(std::uint16_t)(0x100u|(s&0xFFu));
  return (std::uint16_t)(lo|(std::uint16_t(hi)<<8));
}
inline std::uint32_t CpuState::popLongReturn(SnesRuntime& hw){
  const auto lo=pop8Value(hw,true),hi=pop8Value(hw,true),bank=pop8Value(hw,true);
  if(e)s=(std::uint16_t)(0x100u|(s&0xFFu));
  pb=bank;
  return (std::uint32_t(bank)<<16)|(std::uint16_t)((lo|(std::uint16_t(hi)<<8))+1u);
}
'''

def install(path: Path):
    text=path.read_text(encoding='utf8')
    if 'CpuState::popLongReturn(SnesRuntime& hw)' in text:
        return False
    if text.count(DECL)!=1 or text.count(ANCHOR)!=1:
        raise ValueError('Unknown legacy stack API: refusing compatibility patch')
    new=text.replace(DECL,DECL+' '+EXTRA).replace(ANCHOR,ANCHOR+'\n'+BRIDGE)
    if new==text:raise ValueError('Stack compatibility insertion failed')
    path.write_text(new,encoding='utf8')
    return True

if __name__=='__main__':
    import argparse
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('runtime',type=Path)
    x=a.parse_args()
    print('STACK_RUNTIME_COMPAT_APPLIED' if install(x.runtime) else 'STACK_RUNTIME_COMPAT_ALREADY_PRESENT')
