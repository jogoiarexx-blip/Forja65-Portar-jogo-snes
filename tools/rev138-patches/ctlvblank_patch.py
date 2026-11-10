"""REV138: FORJA65_CONTROL_AT=vblank - o modo de controle para no inicio do VBlank (como o retro_run do Snes9x/bsnes)."""
REP=[("frameCounter++;writeFrameProgress();if(controlMode)controlFrame();","frameCounter++;writeFrameProgress();if(controlMode&&!controlAtVblank)controlFrame();"),
     ("if(currentScanline==vis){io.vblank=true;ppu.resetOamAddressOnVblank();","if(currentScanline==vis){if(controlMode&&controlAtVblank)controlFrame();io.vblank=true;ppu.resetOamAddressOnVblank();"),
     ('bool controlMode{envFlag("FORJA65_CONTROL")};','bool controlMode{envFlag("FORJA65_CONTROL")};bool controlAtVblank{std::getenv("FORJA65_CONTROL_AT")&&std::string(std::getenv("FORJA65_CONTROL_AT"))=="vblank"};')]
def patch(t,js=False):
    if 'controlAtVblank' in t: return t
    for a,b in REP:
        if js: a=a.replace('"','\\"'); b=b.replace('"','\\"')
        n=t.count(a)
        assert n>=1,(a[:50],n)
        t=t.replace(a,b)
    return t
if __name__=='__main__':
    import sys; p=sys.argv[1]; t=patch(open(p).read()); open(p,'w').write(t); print('ok')
