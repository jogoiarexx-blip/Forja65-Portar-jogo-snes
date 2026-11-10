#!/usr/bin/env python3
"""Independent numeric BRR oracle. No emulator source is vendored.
History here is FULL even PCM; production stores half PCM.
Usage: python3 tools/brr-reference-v025.py output.txt
"""
import sys

def decode(header, data, previous, older):
    out=[]
    for byte in data:
        for q in (byte >> 4, byte & 15):
            q=q if q < 8 else q-16
            shift=header >> 4
            s=(q * 2**shift)//2 if shift<=12 else (-2048 if q<0 else 0)
            f=(header >> 2)&3
            if f==1:
                s+=previous//2+(-previous)//32
            elif f==2:
                s+=previous-older//2+(-3*previous)//64+(older//2)//16
            elif f==3:
                s+=previous-older//2+(-13*previous)//128+(3*(older//2))//16
            s=max(-32768,min(32767,s))
            pcm=((s*2+32768)%65536)-32768
            out.append(pcm)
            older,previous=previous,pcm
    return out

def vectors():
    # Minimal witnesses first, followed by all ranges/filters/nibbles and
    # a signed history grid. Each record has a two-block history chain.
    yield 0,[0xF0]*16,0,0
    yield 0xC4,[0x77]*16,32766,32766
    history=(-32768,-16386,-2,0,2,16382,32766)
    for shift in range(16):
        for f in range(4):
            for nib in range(16):
                for p in history:
                    for o in history:
                        yield (shift<<4)|(f<<2), [nib*17]*8+[0x87,0xF1,0x08,0x7F,0xFE,0x10,0x79,0xB3],p,o

if __name__=='__main__':
    assert decode(0,[0xF0],0,0)==[-2,0]
    assert decode(0xC4,[0x77],32766,32766)==[-6146,22910]
    with open(sys.argv[1],'w') as out:
        for header,data,p,o in vectors():
            out.write(' '.join(map(str,[header,p,o,*data,*decode(header,data,p,o)]))+'\n')
