import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from smk_pilot import *

def test():
    # heading=0 points up, +90 degrees points right. Controls are the real SNES joypad bits.
    assert steering(100,100,0,100,90)==B
    assert steering(100,100,0,110,100)==B|RIGHT
    assert steering(100,100,0,90,100)==B|LEFT
    assert steering(65530,100,0,5,100)==B|RIGHT # 16-bit wrapped X
    assert steering(5,100,0,65530,100)==B|LEFT
    b=bytearray(8*STRIDE)
    for i,x in [(0,100),(4,120)]:
        p=i*STRIDE
        b[p+0x18:p+0x1a]=x.to_bytes(2,'little')
        b[p+0x1c:p+0x1e]=(100).to_bytes(2,'little')
        b[p+0xc1]=128
    ap=PurePursuit(kart=4,lookahead=4)
    mask,player=ap.drive(bytes(b))
    assert mask==B|RIGHT and player.lap==0
    assert ap.drive(bytes(b))[0] & B
    try:
        Racer.parse(b[:30],4)
        raise AssertionError('truncated WRAM snapshot should fail')
    except ValueError: pass
    print('PASS 8 Mario Kart pilot arithmetic, WRAM and input regressions')

if __name__=='__main__':test()
