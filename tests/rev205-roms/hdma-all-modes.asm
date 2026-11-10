// Forja65 REV205 - HDMA on all 8 channels, all transfer modes, direct and indirect
//
//  ch0 mode 2 direct, repeat entries        -> BG1HOFS (per-line wave)
//  ch1 mode 3 indirect                      -> CGADD/CGDATA (backdrop colour per line)
//  ch2 mode 1 direct                        -> WH0/WH1 (window 1 shape on BG1)
//  ch3 mode 0 indirect, repeat block >0x80  -> COLDATA
//  ch4 mode 0 direct, >128 line entries     -> INIDISP (brightness bands)
//  ch5 mode 6 (alias of 2) direct           -> BG2HOFS
//  ch6 mode 7 (alias of 3) direct           -> BG3HOFS/BG3VOFS
//  ch7 mode 2 indirect, table in WRAM       -> BG2VOFS, rewritten by the CPU every frame
//
// At every VBlank the $43x8-$43xA registers of all channels are logged to WRAM, so the HDMA
// pointer/line-counter state at the end of the frame can be compared byte by byte.
//
// Written for the Forja65 conformance corpus on top of undisbeliever's snes-test-roms framework (zlib).

define MEMORY_MAP = LOROM
define ROM_SIZE = 1
define ROM_SPEED = slow
define REGION = Japan
define ROM_NAME = "FORJA HDMA MODES"
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

allocate(frame,     zeropage, 2)
allocate(tmp,       zeropage, 2)
allocate(hdmaLog,   wram7e, 24)
allocate(ch7Data,   wram7e, 256)
allocate(ch7Table,  wram7e, 64)

macro VBlank() {
    assert8a()
    assert16i()
    // log $43x8, $43x9, $43xa of all 8 channels
    ldx.w   #0
    ldy.w   #0
    -
        lda.w   0x4308,x
        phx
        tyx
        sta.l   hdmaLog,x
        plx
        iny
        lda.w   0x4309,x
        phx
        tyx
        sta.l   hdmaLog,x
        plx
        iny
        lda.w   0x430a,x
        phx
        tyx
        sta.l   hdmaLog,x
        plx
        iny
        rep     #$20
    a16()
        txa
        clc
        adc.w   #0x10
        tax
        sep     #$20
    a8()
        cpx.w   #0x80
        bne     -

    lda.b   #0xff
    sta.w   HDMAEN
}

include "../vblank_interrupts.inc"


// Program one channel. A = DMAP, X = table address (bank 0x80), Y = channel*16
macro Chan(evaluate n, evaluate dmap, evaluate bbad, table, evaluate bank, evaluate indbank) {
    lda.b   #{dmap}
    sta.w   0x4300 + {n} * 16
    lda.b   #{bbad}
    sta.w   0x4301 + {n} * 16
    ldx.w   #{table}
    stx.w   0x4302 + {n} * 16
    lda.b   #{bank}
    sta.w   0x4304 + {n} * 16
    lda.b   #{indbank}
    sta.w   0x4307 + {n} * 16
}


a8()
i16()
code()
function SetupHdma {
    Chan(0, 0x02, 0x0d, Ch0Table, 0x80, 0x80)
    Chan(1, 0x43, 0x21, Ch1Table, 0x80, 0x80)
    Chan(2, 0x01, 0x26, Ch2Table, 0x80, 0x80)
    Chan(3, 0x40, 0x32, Ch3Table, 0x80, 0x80)
    Chan(4, 0x00, 0x00, Ch4Table, 0x80, 0x80)
    Chan(5, 0x06, 0x0f, Ch5Table, 0x80, 0x80)
    Chan(6, 0x07, 0x11, Ch6Table, 0x80, 0x80)
    Chan(7, 0x42, 0x10, ch7Table, 0x7e, 0x7e)
    rts
}


// Rebuild the WRAM indirect table data of channel 7 for `frame`
a8()
i16()
code()
function BuildCh7 {
    // table: 4 entries of 0x38 lines (non repeat), each pointing at 2 bytes of ch7Data, then end
    ldx.w   #0
    ldy.w   #0
    -
        lda.b   #0x38
        sta.l   ch7Table,x
        inx
        rep     #$20
    a16()
        tya
        asl
        clc
        adc.w   #ch7Data
        sta.l   ch7Table,x
        sep     #$20
    a8()
        inx
        inx
        iny
        cpy.w   #4
        bne     -
    lda.b   #0
    sta.l   ch7Table,x

    // data: vertical offsets that move with the frame counter
    rep     #$20
a16()
    ldx.w   #0
    lda.b   frame
    -
        sta.l   ch7Data,x
        clc
        adc.w   #7
        inx
        inx
        cpx.w   #8
        bne     -
    sep     #$20
a8()
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

    lda.b   #0x80
    sta.w   VMAIN
    ldx.w   #0x0000
    stx.w   VMADD
    Dma.ForceBlank.ToVram(Tiles, 0x2000)
    ldx.w   #0x7000
    stx.w   VMADD
    Dma.ForceBlank.ToVram(BgMap, 0x800)
    ldx.w   #0x7400
    stx.w   VMADD
    Dma.ForceBlank.ToVram(BgMap + 0x40, 0x7c0)
    ldx.w   #0x7800
    stx.w   VMADD
    Dma.ForceBlank.ToVram(BgMap + 0x80, 0x780)

    stz.w   CGADD
    Dma.ForceBlank.ToCgram(Palette, 512)

    lda.b   #BGMODE.mode1
    sta.w   BGMODE
    stz.w   BG12NBA
    stz.w   BG34NBA
    lda.b   #0x70
    sta.w   BG1SC
    lda.b   #0x74
    sta.w   BG2SC
    lda.b   #0x78
    sta.w   BG3SC
    lda.b   #TM.bg1 | TM.bg2 | TM.bg3
    sta.w   TM
    // window 1 masks BG1 inside, colour math adds COLDATA to BG2 and backdrop
    lda.b   #0x02
    sta.w   W12SEL
    lda.b   #TM.bg1
    sta.w   TMW
    stz.w   CGWSEL
    lda.b   #0x22
    sta.w   CGADSUB

    ldx.w   #0
    stx.b   frame
    jsr     BuildCh7
    jsr     SetupHdma

    EnableVblankInterrupts()
    jsr     WaitFrame

    MainLoop:
        jsr     WaitFrame
        rep     #$20
    a16()
        inc.b   frame
        sep     #$20
    a8()
        jsr     BuildCh7
        jmp     MainLoop
}


code()
// ch0: mode 2 direct. 3 x (repeat 0x30 lines with per-line words) + plain entries
Ch0Table:
    db  0x80 | 0x20
    variable _i = 0
    while _i < 0x20 {
        dw  (_i * 3) & 0x3f
        _i = _i + 1
    }
    db  0x40
    dw  0x10
    db  0x80 | 0x30
    variable _i = 0
    while _i < 0x30 {
        dw  (0x30 - _i) & 0x3f
        _i = _i + 1
    }
    db  0x10
    dw  0x1f0
    db  0
Ch1Table:
    db  0x30
    dw  Ch1Colours
    db  0x30
    dw  Ch1Colours + 4
    db  0x80 | 0x08
    dw  Ch1Colours + 8
    db  0x30
    dw  Ch1Colours + 40
    db  0
Ch1Colours:
    variable _i = 0
    while _i < 12 {
        db  0, 0
        dw  ((_i * 5) & 31) | (((_i * 3) & 31) << 5) | (((31 - _i * 2) & 31) << 10)
        _i = _i + 1
    }
Ch2Table:
    db  0x80 | 0x40
    variable _i = 0
    while _i < 0x40 {
        db  0x40 + (_i & 0x1f), 0xa0 + (_i & 0x0f)
        _i = _i + 1
    }
    db  0x50
    db  0x10, 0x20
    db  0
Ch3Table:
    db  0x20
    dw  Ch3Values
    db  0x80 | 0x10
    dw  Ch3Values + 1
    db  0x40
    dw  Ch3Values + 17
    db  0
Ch3Values:
    db  0x20 | 4
    variable _i = 0
    while _i < 16 {
        db  0x40 | (_i * 2)
        _i = _i + 1
    }
    db  0x80 | 6
Ch4Table:
    db  0x7f, 0x0f
    db  0x10, 0x09
    db  0x7f, 0x0c
    db  0
Ch5Table:
    db  0x80 | 0x18
    variable _i = 0
    while _i < 0x18 {
        dw  _i * 4
        _i = _i + 1
    }
    db  0x60
    dw  0x100
    db  0
Ch6Table:
    db  0x50
    dw  0x0008, 0x0010
    db  0x50
    dw  0x0020, 0x0004
    db  0
Palette:
    variable _i = 0
    while _i < 256 {
        dw  ((_i * 11) & 31) | (((_i * 5 + 7) & 31) << 5) | (((_i * 9 + 2) & 31) << 10)
        _i = _i + 1
    }
BgMap:
    variable _r = 0
    while _r < 32 {
        variable _c = 0
        while _c < 32 {
            dw  ((_c * 5 + _r * 7) & 0xff) | (((_c + _r) & 7) << 10)
            _c = _c + 1
        }
        _r = _r + 1
    }
Tiles:
    variable _t = 0
    while _t < 256 {
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
                        variable _col = ((_x * _y) + _t) & 15
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
