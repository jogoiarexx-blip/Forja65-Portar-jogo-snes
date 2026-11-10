// Forja65 REV205 - sprite (OBJ) rendering stress test
//
// Every frame the CPU rebuilds a 544 byte OAM shadow (128 sprites, moving, 9 bit X, both sizes,
// h/v flip, 8 palettes, 4 priorities against a BG1 with per-tile priority, both name tables) and the
// NMI handler uploads it with DMA. The NMI also cycles OBSEL (all 8 size modes, the 4 name-select
// gaps) and rotates the OAM priority start (OAMADDH bit 7). STAT77 (range/time over) is stored per
// frame. Sprites 4-7 palettes take part in colour math (add fixed colour).
//
// Written for the Forja65 conformance corpus on top of undisbeliever's snes-test-roms framework (zlib).

define MEMORY_MAP = LOROM
define ROM_SIZE = 1
define ROM_SPEED = slow
define REGION = Japan
define ROM_NAME = "FORJA OAM RENDER"
define VERSION = 1

architecture wdc65816-strict

include "../common.inc"

createCodeBlock(code,       0x808000, 0x80ffaf)

createRamBlock(zeropage,        0x00,     0xff)
createRamBlock(lowram,      0x7e0100, 0x7e1f7f)
createRamBlock(stack,       0x7e1f80, 0x7e1fff)
createRamBlock(wram7e,      0x7e2000, 0x7effff)

include "../reset_handler.inc"
include "../break_handler.inc"
include "../dma_forceblank.inc"

allocate(frame,    zeropage, 2)
allocate(xacc,     zeropage, 2)
allocate(yacc,     zeropage, 2)
allocate(tileacc,  zeropage, 2)
allocate(spr,      zeropage, 2)
allocate(hiByte,   zeropage, 2)
allocate(obselShadow, zeropage, 1)
allocate(prioShadow,  zeropage, 1)
allocate(shadow,   wram7e, 544)
allocate(stat77Log, wram7e, 256)

macro VBlank() {
    assert8a()
    assert16i()
    stz.w   OAMADDL
    stz.w   OAMADDH
    stz.w   DMAP0
    lda.b   #OAMDATA
    sta.w   BBAD0
    ldx.w   #shadow
    stx.w   A1T0
    lda.b   #shadow >> 16
    sta.w   A1B0
    ldx.w   #544
    stx.w   DAS0
    lda.b   #1
    sta.w   MDMAEN

    lda.b   obselShadow
    sta.w   OBSEL
    lda.b   prioShadow
    sta.w   OAMADDL
    lda.b   #0x80
    sta.w   OAMADDH

    // log STAT77 flags of the frame that just ended
    rep     #$20
a16()
    lda.b   frame
    and.w   #0x00ff
    tax
    sep     #$20
a8()
    lda.w   STAT77
    sta.l   stat77Log,x
}

include "../vblank_interrupts.inc"


// Rebuild the OAM shadow for `frame`
a8()
i16()
code()
function BuildOam {
    rep     #$30
a16()
    lda.b   frame
    and.w   #0x01ff
    sta.b   xacc
    lda.b   frame
    asl
    sta.b   yacc
    lda.b   frame
    lsr
    lsr
    sta.b   tileacc
    stz.b   hiByte
    stz.b   spr
    sep     #$20
a8()

    ldx.w   #0
    Loop:
        rep     #$20
    a16()
        lda.b   xacc
        clc
        adc.w   #23
        and.w   #0x01ff
        sta.b   xacc
        sep     #$20
    a8()
        sta.l   shadow,x

        lda.b   yacc
        clc
        adc.b   #13
        sta.b   yacc
        sta.l   shadow + 1,x

        lda.b   tileacc
        clc
        adc.b   #3
        sta.b   tileacc
        sta.l   shadow + 2,x

        ldy.b   spr
        lda.w   AttrTable,y
        sta.l   shadow + 3,x

        // two high-table bits: X bit 8 and size
        lsr.b   hiByte
        lsr.b   hiByte
        lda.b   xacc + 1
        and.b   #1
        ora.w   SizeTable,y
        asl
        asl
        asl
        asl
        asl
        asl
        ora.b   hiByte
        sta.b   hiByte

        lda.b   spr
        and.b   #3
        cmp.b   #3
        bne     +
            rep     #$20
        a16()
            lda.b   spr
            lsr
            lsr
            phx
            tax
            sep     #$20
        a8()
            lda.b   hiByte
            sta.l   shadow + 512,x
            plx
        +

        inx
        inx
        inx
        inx
        inc.b   spr
        lda.b   spr
        cmp.b   #128
        beq     +
        jmp     Loop
    +

    // OBSEL: size mode cycles every 16 frames (all 8), name gap every 4 frames, base 0
    rep     #$20
a16()
    lda.b   frame
    lsr
    lsr
    lsr
    lsr
    and.w   #7
    asl
    asl
    asl
    asl
    asl
    sta.b   hiByte
    lda.b   frame
    lsr
    lsr
    and.w   #3
    asl
    asl
    asl
    ora.b   hiByte
    sep     #$20
a8()
    sta.b   obselShadow

    lda.b   frame
    asl
    adc.b   frame
    sta.b   prioShadow
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

    // 512 tiles at word 0x0000, then other slices at 0x2000/0x3000/0x4000 so every name-select gap
    // shows different graphics
    lda.b   #0x80
    sta.w   VMAIN
    ldx.w   #0x0000
    stx.w   VMADD
    Dma.ForceBlank.ToVram(Tiles, 0x4000)
    ldx.w   #0x2000
    stx.w   VMADD
    Dma.ForceBlank.ToVram(Tiles + 0x2000, 0x2000)
    ldx.w   #0x3000
    stx.w   VMADD
    Dma.ForceBlank.ToVram(Tiles + 0x1000, 0x2000)
    ldx.w   #0x4000
    stx.w   VMADD
    Dma.ForceBlank.ToVram(Tiles + 0x3000, 0x1000)
    ldx.w   #0x7c00
    stx.w   VMADD
    Dma.ForceBlank.ToVram(BgMap, 0x800)

    stz.w   CGADD
    Dma.ForceBlank.ToCgram(Palette, 512)

    lda.b   #BGMODE.mode1
    sta.w   BGMODE
    stz.w   BG12NBA
    lda.b   #0x7c
    sta.w   BG1SC
    lda.b   #TM.bg1 | TM.obj
    sta.w   TM
    stz.w   CGWSEL
    lda.b   #0x11
    sta.w   CGADSUB
    lda.b   #0x28
    sta.w   COLDATA
    lda.b   #0x44
    sta.w   COLDATA

    ldx.w   #0
    stx.b   frame
    jsr     BuildOam

    EnableVblankInterrupts()
    jsr     WaitFrame

    lda.b   #0x0f
    sta.w   INIDISP

    MainLoop:
        jsr     WaitFrame
        rep     #$20
    a16()
        inc.b   frame
        sep     #$20
    a8()
        jsr     BuildOam
        jmp     MainLoop
}


code()
AttrTable:
    variable _i = 0
    while _i < 128 {
        variable _a = ((_i & 7) << 1) | (((_i >> 3) & 3) << 4)
        if (_i & 16) != 0 {
            _a = _a | 0x40
        }
        if (_i & 32) != 0 {
            _a = _a | 0x80
        }
        if (_i & 64) != 0 {
            _a = _a | 0x01
        }
        db  _a
        _i = _i + 1
    }

SizeTable:
    variable _i = 0
    while _i < 128 {
        db  ((_i >> 2) & 1) << 1
        _i = _i + 1
    }

Palette:
    variable _i = 0
    while _i < 256 {
        dw  ((_i * 7) & 31) | (((_i * 13 + 3) & 31) << 5) | (((_i * 3 + 5) & 31) << 10)
        _i = _i + 1
    }

BgMap:
    variable _r = 0
    while _r < 32 {
        variable _c = 0
        while _c < 32 {
            variable _e = ((_c + _r * 3) & 0xff) | (((_r >> 2) & 7) << 10)
            if (_c & 4) != 0 {
                _e = _e | 0x2000
            }
            dw  _e
            _c = _c + 1
        }
        _r = _r + 1
    }

Tiles:
    variable _t = 0
    while _t < 512 {
        variable _h = 0
        while _h < 2 {
            variable _y = 0
            while _y < 8 {
                variable _q = 0
                while _q < 2 {
                    variable _plane = _h * 2 + _q
                    variable _b = 0
                    variable _x = 0
                    while _x < 8 {
                        variable _col = (_x + _y * 2 + _t) & 15
                        if ((_x ^ _y ^ _t) & 7) == 0 {
                            _col = 0
                        }
                        _b = (_b << 1) | ((_col >> _plane) & 1)
                        _x = _x + 1
                    }
                    db  _b
                    _q = _q + 1
                }
                _y = _y + 1
            }
            _h = _h + 1
        }
        _t = _t + 1
    }

finalizeMemory()
