#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>

int main() {
    ApuBridge apu;
    // This v0405 fixture exercises immediate legacy note/envelope semantics.
    // Current hardware envelope/key scheduling has separate dedicated suites.
    apu.dsp.hardwareEnvelopeTiming=false;
    apu.dsp.hardwareKeyTiming=false;
    // Bit 7 on DSPADDR prevents writes without changing the stored address.
    apu.spcWrite(0xF2, 0x0C);
    apu.spcWrite(0xF3, 0x7F);
    assert(apu.dsp.readReg(0x0C)==0x7F);
    apu.spcWrite(0xF2, 0x8C);
    assert(apu.spcRead(0xF2)==0x8C); // DSPADDR retains all eight readable bits; bit 7 inhibits DSPDATA writes.
    apu.spcWrite(0xF3, 0x00);
    assert(apu.dsp.readReg(0x0C)==0x7F);
    assert(apu.spcRead(0xF3)==0x7F);
    assert(apu.spc.dsp[0x0C]==0x7F);
    apu.spcWrite(0xF2, 0x1C);
    apu.spcWrite(0xF3, 0x7F);
    apu.spcWrite(0xF2, 0x00);
    apu.spcWrite(0xF3, 0x7F);
    apu.spcWrite(0xF2, 0x01);
    apu.spcWrite(0xF3, 0x7F);
    // BRR sample directory at $0100, block at $0200 (non-looping, end flag).
    apu.spc.ram[0x100]=0x00; apu.spc.ram[0x101]=0x02;
    apu.spc.ram[0x102]=0x00; apu.spc.ram[0x103]=0x02;
    apu.spc.ram[0x200]=0x01;
    for (int n=0; n<8; ++n) apu.spc.ram[0x201+n]=0x77;
    apu.spcWrite(0xF2,0x07); apu.spcWrite(0xF3,0x7F);
    apu.spcWrite(0xF2,0x5D); apu.spcWrite(0xF3,0x01);
    apu.spcWrite(0xF2,0x02); apu.spcWrite(0xF3,0x00);
    apu.spcWrite(0xF2,0x03); apu.spcWrite(0xF3,0x10);
    apu.spcWrite(0xF2,0x4C); apu.spcWrite(0xF3,0x01);
    assert(apu.dsp.voice[0].active);
    auto played=apu.dsp.renderSample(apu.spc.ram);
    assert(played[0]!=0 && played[1]!=0);
    // FLG mute silences output, but BRR processing must continue.
    auto pos=apu.dsp.voice[0].blockPos;
    apu.spcWrite(0xF2,0x6C); apu.spcWrite(0xF3,0x40);
    auto muted=apu.dsp.renderSample(apu.spc.ram);
    assert(muted[0]==0 && muted[1]==0);
    assert(apu.dsp.voice[0].blockPos!=pos);
    apu.spcWrite(0xF3,0x00);
    assert(apu.dsp.renderSample(apu.spc.ram)[0]!=0);
    for(int n=0;n<25 && apu.dsp.voice[0].active;++n) apu.dsp.renderSample(apu.spc.ram);
    assert(!apu.dsp.voice[0].active);
    assert((apu.dsp.readReg(0x7C)&1)==1);
    // Starting a new note must clear that voice's ENDX latch.
    apu.spcWrite(0xF2,0x4C); apu.spcWrite(0xF3,0x01);
    assert(apu.dsp.voice[0].active && (apu.dsp.readReg(0x7C)&1)==0);
    for(int n=0;n<25 && apu.dsp.voice[0].active;++n) apu.dsp.renderSample(apu.spc.ram);
    assert((apu.dsp.readReg(0x7C)&1)==1);
    // ENDX write clears the sticky end-of-block flags.
    apu.spcWrite(0xF2,0x7C); apu.spcWrite(0xF3,0xFF);
    assert(apu.dsp.readReg(0x7C)==0);
    assert(apu.spc.dsp[0x7C]==0);
    apu.spcWrite(0xF2,0x4C); apu.spcWrite(0xF3,0x01);
    assert(apu.dsp.voice[0].active);
    // BRR end+loop sets ENDX but keeps the voice active and returns to loop address.
    apu.spc.ram[0x200]=0x03;
    for(int n=0;n<24;++n) apu.dsp.renderSample(apu.spc.ram);
    assert(apu.dsp.voice[0].active);
    assert((apu.dsp.readReg(0x7C)&1)==1);
    // Soft reset silences voices in this preliminary DSP backend.
    apu.spcWrite(0xF2,0x6C); apu.spcWrite(0xF3,0x80);
    assert(!apu.dsp.voice[0].active);
    std::cout << "APU/DSP: DSPADDR inhibit, mute, ENDX, soft-reset PASS\n";
}
