; Forja65 REV143 - ROM de teste de temporizacao de NMI/IRQ (dominio publico / MIT)
; Laco ocupado com NMI e IRQ-V; mede entrada de interrupcao em modo nativo e emulacao.
.p816
.smart -
.a8
.i8
.segment "CODE"
reset:
    sei
    clc
    xce
    rep #$38
.a16
.i16
    ldx #$01FF
    txs
    lda #$0000
    tcd
    stz $10
    stz $12
    stz $14
    stz $20
    stz $22
    stz $24
    stz $26
    sep #$20
.a8
    lda #$80
    sta $2100          ; forced blank
    stz $4200
    ; V-IRQ na linha 100
    lda #100
    sta $4209
    stz $420A
    lda #$A0           ; NMI + V-IRQ
    sta $4200
    cli
    rep #$20
.a16
loop:
    inc $10
    inc $12
    lda $10
    cmp #$0400
    bne loop
    ; depois de 1024 iteracoes alterna para modo emulacao
    sep #$20
.a8
    sec
    xce
emuloop:
    inc $14
    bne emuloop
    inc $15
    bra emuloop

nmi:
    rep #$20
.a16
    pha
    inc $20
    lda $4210
    pla
    rti
irq:
    rep #$20
.a16
    pha
    lda $4211
    inc $22
    pla
    rti
emunmi:
.a8
    pha
    lda $4210
    inc $24
    pla
    rti
emuirq:
    pha
    lda $4211
    inc $26
    pla
    rti

.segment "HEADER"
    .byte "FORJA65 NMI TIMING   "
.segment "ROMINFO"
    .byte $20, $00, $07, $00, $01, $00, $00
    .word $FFFF, $0000
.segment "VECTORS"
    .word 0,0,0,0,0, nmi, 0, irq
    .word 0,0,0,0,0, emunmi, reset, emuirq
