// Forja65 REV205 - PPU memory port and DMA readback test
//
// Exercises the OAM, VRAM and CGRAM ports ($2102-$2104, $2115-$2119, $2121-$2122) and their
// readback registers ($2138-$213B), plus all eight DMA transfer modes (A->B and B->A), fixed and
// decrementing DMA, WRAM port DMA and the DMA register state after a transfer.
// Every observed value is stored in WRAM ($7e2000+) so an emulator/port can be compared byte by byte.
//
// Written for the Forja65 conformance corpus on top of undisbeliever's snes-test-roms framework (zlib).

define MEMORY_MAP = LOROM
define ROM_SIZE = 1
define ROM_SPEED = slow
define REGION = Japan
define ROM_NAME = "FORJA PPU READBACK"
define VERSION = 1

architecture wdc65816-strict

include "../common.inc"

createCodeBlock(code,       0x808000, 0x80ffaf)
createCodeBlock(rodata0,    0x818000, 0x81ffff)

createRamBlock(zeropage,        0x00,     0xff)
createRamBlock(lowram,      0x7e0100, 0x7e1f7f)
createRamBlock(stack,       0x7e1f80, 0x7e1fff)
createRamBlock(wram7e,      0x7e2000, 0x7effff)

include "../reset_handler.inc"
include "../break_handler.inc"
include "../dma_forceblank.inc"

allocate(resIdx, zeropage, 2)
allocate(tmpLoop, zeropage, 2)
allocate(results, wram7e, 0x2000)
allocate(dmaIn,   wram7e, 0x100)
allocate(perFrame, wram7e, 0x10)

macro VBlank() {
    assert8a()
    assert16i()
    // STAT77/STAT78 flags (sprite range/time over) observed every frame
    lda.w   STAT77
    and.b   #0xc0
    sta.l   perFrame
    lda.l   perFrame + 1
    inc
    sta.l   perFrame + 1
}

include "../vblank_interrupts.inc"


// Store A (8 bit) at results[resIdx++]
// REQUIRES: 8 bit A, 16 bit Index
a8()
i16()
code()
function Store {
    phx
    ldx.b   resIdx
    sta.l   results,x
    inx
    stx.b   resIdx
    plx
    rts
}


// Store a marker byte so each section is easy to find in a WRAM diff
macro Mark(evaluate m) {
    lda.b   #{m}
    jsr     Store
}


a8()
i16()
code()
function OamTests {
    Mark(0xA1)
    // Fill the whole OAM through $2104
    stz.w   OAMADDL
    stz.w   OAMADDH
    ldx.w   #0
    Fill:
        txa
        eor.b   #0x5a
        sta.w   OAMDATA
        inx
        cpx.w   #544
        bne     Fill

    // Read all 544 bytes through $2138
    stz.w   OAMADDL
    stz.w   OAMADDH
    ldx.w   #0
    Read:
        lda.w   OAMDATAREAD
        jsr     Store
        inx
        cpx.w   #544
        bne     Read

    Mark(0xA2)
    // A lone low byte only goes to the latch; the next word is written on the odd byte
    lda.b   #5
    sta.w   OAMADDL
    stz.w   OAMADDH
    lda.b   #0x11
    sta.w   OAMDATA
    lda.b   #6
    sta.w   OAMADDL
    stz.w   OAMADDH
    lda.b   #0x22
    sta.w   OAMDATA
    lda.b   #0x33
    sta.w   OAMDATA
    lda.b   #5
    sta.w   OAMADDL
    stz.w   OAMADDH
    ldx.w   #6
    -
        lda.w   OAMDATAREAD
        jsr     Store
        dex
        bne     -

    Mark(0xA3)
    // High table writes are immediate (no latch)
    stz.w   OAMADDL
    lda.b   #1
    sta.w   OAMADDH
    lda.b   #0xa1
    sta.w   OAMDATA
    lda.b   #0xb2
    sta.w   OAMDATA
    lda.b   #0xc3
    sta.w   OAMDATA

    // Read from word 0x10f: walks the high table mirror and wraps
    lda.b   #0x0f
    sta.w   OAMADDL
    lda.b   #1
    sta.w   OAMADDH
    ldx.w   #40
    -
        lda.w   OAMDATAREAD
        jsr     Store
        dex
        bne     -

    Mark(0xA4)
    // OAMADDH priority bit must not change the address
    lda.b   #0x10
    sta.w   OAMADDL
    lda.b   #0x80
    sta.w   OAMADDH
    ldx.w   #8
    -
        lda.w   OAMDATAREAD
        jsr     Store
        dex
        bne     -
    rts
}


a8()
i16()
code()
function VramTests {
    Mark(0xB1)
    // 128 words at word 0x1000, VMAIN increments after the high byte
    lda.b   #0x80
    sta.w   VMAIN
    ldx.w   #0x1000
    stx.w   VMADD
    rep     #$30
a16()
    ldx.w   #0
    -
        txa
        eor.w   #0x3c96
        sta.w   VMDATA
        inx
        cpx.w   #128
        bne     -
    sep     #$20
a8()

    // Read back with increment on high byte (prefetch on VMADD write)
    ldx.w   #0x1000
    stx.w   VMADD
    ldy.w   #16
    -
        lda.w   VMDATALREAD
        jsr     Store
        lda.w   VMDATAHREAD
        jsr     Store
        dey
        bne     -

    Mark(0xB2)
    // Increment after low byte
    stz.w   VMAIN
    ldx.w   #0x1000
    stx.w   VMADD
    ldy.w   #16
    -
        lda.w   VMDATALREAD
        jsr     Store
        lda.w   VMDATAHREAD
        jsr     Store
        dey
        bne     -

    Mark(0xB3)
    // Only high byte reads with VMAIN=0x80, then only low reads with VMAIN=0x00
    lda.b   #0x80
    sta.w   VMAIN
    ldx.w   #0x1010
    stx.w   VMADD
    ldy.w   #8
    -
        lda.w   VMDATAHREAD
        jsr     Store
        dey
        bne     -
    stz.w   VMAIN
    ldx.w   #0x1020
    stx.w   VMADD
    ldy.w   #8
    -
        lda.w   VMDATALREAD
        jsr     Store
        dey
        bne     -

    Mark(0xB4)
    // Increment 32 and 128
    lda.b   #0x81
    sta.w   VMAIN
    ldx.w   #0x1000
    stx.w   VMADD
    ldy.w   #4
    -
        lda.w   VMDATALREAD
        jsr     Store
        lda.w   VMDATAHREAD
        jsr     Store
        dey
        bne     -
    lda.b   #0x82
    sta.w   VMAIN
    ldx.w   #0x1003
    stx.w   VMADD
    lda.w   VMDATALREAD
    jsr     Store
    lda.w   VMDATAHREAD
    jsr     Store

    Mark(0xB5)
    // Address remapping (8, 9 and 10 bit rotations)
    lda.b   #0x84
    -
        sta.w   VMAIN
        pha
        ldx.w   #0x1000
        stx.w   VMADD
        ldy.w   #6
        --
            lda.w   VMDATALREAD
            jsr     Store
            lda.w   VMDATAHREAD
            jsr     Store
            dey
            bne     --
        pla
        clc
        adc.b   #4
        cmp.b   #0x90
        bne     -

    Mark(0xB6)
    // Byte writes with increment on low byte; read back
    stz.w   VMAIN
    ldx.w   #0x1100
    stx.w   VMADD
    lda.b   #0x71
    sta.w   VMDATAH
    lda.b   #0x72
    sta.w   VMDATAL
    lda.b   #0x73
    sta.w   VMDATAH
    lda.b   #0x74
    sta.w   VMDATAL
    lda.b   #0x80
    sta.w   VMAIN
    ldx.w   #0x1100
    stx.w   VMADD
    ldy.w   #3
    -
        lda.w   VMDATALREAD
        jsr     Store
        lda.w   VMDATAHREAD
        jsr     Store
        dey
        bne     -

    Mark(0xB7)
    // Reading without rewriting VMADD returns the prefetch buffer, not the new data
    ldx.w   #0x1200
    stx.w   VMADD
    lda.b   #0x5e
    sta.w   VMDATAL
    lda.b   #0x5f
    sta.w   VMDATAH
    ldx.w   #0x1200
    stx.w   VMADD
    lda.w   VMDATALREAD
    jsr     Store
    lda.w   VMDATAHREAD
    jsr     Store
    rts
}


a8()
i16()
code()
function CgramTests {
    Mark(0xC1)
    stz.w   CGADD
    ldx.w   #0
    -
        txa
        eor.b   #0xa5
        sta.w   CGDATA
        inx
        cpx.w   #512
        bne     -

    stz.w   CGADD
    ldx.w   #0
    -
        lda.w   CGDATAREAD
        jsr     Store
        lda.w   CGDATAREAD
        and.b   #0x7f               // bit 7 is PPU2 open bus
        jsr     Store
        inx
        cpx.w   #256
        bne     -

    Mark(0xC2)
    // A lone byte stays in the latch; CGADD resets the flip-flop
    lda.b   #0x10
    sta.w   CGADD
    lda.b   #0x11
    sta.w   CGDATA
    lda.b   #0x10
    sta.w   CGADD
    lda.b   #0x22
    sta.w   CGDATA
    lda.b   #0x33
    sta.w   CGDATA
    lda.b   #0x10
    sta.w   CGADD
    lda.w   CGDATAREAD
    jsr     Store
    lda.w   CGDATAREAD
    and.b   #0x7f
    jsr     Store
    rts
}


// Run one DMA on channel 0
// IN: A = DMAP, Y = byte count; source DmaSource bank 0x81
a8()
i16()
code()
function DmaToVram {
    sta.w   DMAP0
    lda.b   #VMDATA
    sta.w   BBAD0
    ldx.w   #DmaSource
    stx.w   A1T0
    lda.b   #DmaSource >> 16
    sta.w   A1B0
    sty.w   DAS0
    lda.b   #1
    sta.w   MDMAEN
    rts
}


// Store DMA channel 0 registers $4300-$430a
a8()
i16()
code()
function StoreDmaRegs {
    ldx.w   #0
    -
        lda.w   DMAP0,x
        jsr     Store
        inx
        cpx.w   #11
        bne     -
    rts
}


a8()
i16()
code()
function DmaTests {
    Mark(0xD1)
    // Modes 0..7 to $2118 (VMAIN 0x80), 20 bytes each, at word 0x2000 + 0x20*mode
    lda.b   #0
    -
        pha
        lda.b   #0x80
        sta.w   VMAIN
        lda     1,s
        rep     #$30
    a16()
        and.w   #0x00ff
        asl
        asl
        asl
        asl
        asl
        clc
        adc.w   #0x2000
        sta.w   VMADD
        sep     #$20
    a8()
        lda     1,s
        ldy.w   #20
        jsr     DmaToVram
        jsr     StoreDmaRegs
        pla
        inc
        cmp.b   #8
        bne     -

    // Fixed source and decrementing source (mode 1)
    lda.b   #0x80
    sta.w   VMAIN
    ldx.w   #0x2100
    stx.w   VMADD
    lda.b   #0x09
    ldy.w   #16
    jsr     DmaToVram
    jsr     StoreDmaRegs

    ldx.w   #0x2120
    stx.w   VMADD
    lda.b   #0x11
    sta.w   DMAP0
    lda.b   #VMDATA
    sta.w   BBAD0
    ldx.w   #DmaSource + 63
    stx.w   A1T0
    lda.b   #DmaSource >> 16
    sta.w   A1B0
    ldy.w   #16
    sty.w   DAS0
    lda.b   #1
    sta.w   MDMAEN
    jsr     StoreDmaRegs

    Mark(0xD2)
    // Read back everything with the CPU
    lda.b   #0x80
    sta.w   VMAIN
    ldx.w   #0x2000
    stx.w   VMADD
    ldx.w   #0
    -
        lda.w   VMDATALREAD
        jsr     Store
        lda.w   VMDATAHREAD
        jsr     Store
        inx
        cpx.w   #0x130
        bne     -

    Mark(0xD3)
    // B->A DMA: VRAM -> WRAM through $2139 (mode 1), 64 bytes
    lda.b   #0x80
    sta.w   VMAIN
    ldx.w   #0x2000
    stx.w   VMADD
    lda.b   #0x81
    sta.w   DMAP0
    lda.b   #VMDATALREAD
    sta.w   BBAD0
    ldx.w   #dmaIn
    stx.w   A1T0
    lda.b   #0x7e
    sta.w   A1B0
    ldx.w   #64
    stx.w   DAS0
    lda.b   #1
    sta.w   MDMAEN
    jsr     StoreDmaRegs

    // A->B DMA to the WRAM port $2180 (writes at dmaIn + 0x40)
    ldx.w   #dmaIn + 0x40
    stx.w   WMADDL
    lda.b   #0x7e & 1
    sta.w   WMADDH
    stz.w   DMAP0
    lda.b   #WMDATA
    sta.w   BBAD0
    ldx.w   #DmaSource
    stx.w   A1T0
    lda.b   #DmaSource >> 16
    sta.w   A1B0
    ldx.w   #32
    stx.w   DAS0
    lda.b   #1
    sta.w   MDMAEN
    jsr     StoreDmaRegs

    Mark(0xD4)
    // CGRAM DMA mode 2 (write twice) and OAM DMA mode 0, then read back
    stz.w   CGADD
    lda.b   #0x02
    sta.w   DMAP0
    lda.b   #CGDATA
    sta.w   BBAD0
    ldx.w   #DmaSource
    stx.w   A1T0
    lda.b   #DmaSource >> 16
    sta.w   A1B0
    ldx.w   #64
    stx.w   DAS0
    lda.b   #1
    sta.w   MDMAEN
    stz.w   CGADD
    ldy.w   #32
    -
        lda.w   CGDATAREAD
        jsr     Store
        lda.w   CGDATAREAD
        and.b   #0x7f
        jsr     Store
        dey
        bne     -

    lda.b   #0x40
    sta.w   OAMADDL
    stz.w   OAMADDH
    stz.w   DMAP0
    lda.b   #OAMDATA
    sta.w   BBAD0
    ldx.w   #DmaSource
    stx.w   A1T0
    lda.b   #DmaSource >> 16
    sta.w   A1B0
    ldx.w   #33
    stx.w   DAS0
    lda.b   #1
    sta.w   MDMAEN
    lda.b   #0x40
    sta.w   OAMADDL
    stz.w   OAMADDH
    ldy.w   #36
    -
        lda.w   OAMDATAREAD
        jsr     Store
        dey
        bne     -
    rts
}


au()
iu()
code()
function Main {
    rep     #$30
    sep     #$20
a8()
i16()
    lda.b   #INIDISP.force | 0x0f
    sta.w   INIDISP

    ldx.w   #0
    stx.b   resIdx

    jsr     OamTests
    jsr     VramTests
    jsr     CgramTests
    jsr     DmaTests

    Mark(0xEE)

    // Show the sprites left in OAM (OBJ tiles at word 0 are the VRAM pattern above)
    lda.b   #0
    sta.w   OBSEL
    lda.b   #TM.obj
    sta.w   TM

    EnableVblankInterrupts()
    jsr     WaitFrame

    lda.b   #0x0f
    sta.w   INIDISP

    MainLoop:
        jsr     WaitFrame
        bra     MainLoop
}


code()
DmaSource:
    variable _i = 0
    while _i < 128 {
        db  (_i * 37 + 11) & 0xff
        _i = _i + 1
    }

finalizeMemory()
