; Forja65 REV143 - ROM de teste de fase CPU/APU no boot (MIT)
; A CPU espera o IPL ($AA/$BB), envia 128 bytes pelo protocolo do IPL e executa no SPC um laco
; que escreve o contador do timer 0 em $F4. Os tempos (V,H) de saida de cada espera no traco
; medem a fase absoluta do SPC700 em relacao a CPU/PPU desde o power-on.
.p816
.smart -
.a8
.i8
.segment "CODE"
reset:
    sei
    clc
    xce
    sep #$30
    lda #$80
    sta $2100
    stz $4200
w1: lda $2140
    cmp #$AA
    bne w1
w2: lda $2141
    cmp #$BB
    bne w2
    lda #$00
    sta $2142
    lda #$02
    sta $2143          ; destino $0200
    lda #$01
    sta $2141          ; transferencia
    lda #$CC
    sta $2140
w3: cmp $2140
    bne w3
    ldx #$00
send:
    lda spcprog,x
    sta $2141
    txa
    sta $2140
w4: cmp $2140
    bne w4
    inx
    cpx #(spcend-spcprog)
    bne send
    ; executa em $0200
    stz $2141
    lda #$00
    sta $2142
    lda #$02
    sta $2143
    txa
    inc
    inc
    sta $2140
w5: cmp $2140
    bne w5
    ; laco final: le $2140 (contador do timer escrito pelo SPC) e grava em WRAM
loop:
    lda $2140
    sta $10
    lda $2141
    sta $11
    bra loop

spcprog:
    ; SPC700: timer 0 com alvo 4, liga; laco: le $FD (saida do timer) e acumula em $F4
    .byte $8F, $04, $FA      ; MOV $FA,#$04
    .byte $8F, $01, $F1      ; MOV $F1,#$01 (liga timer 0; desliga IPL? bit7=0 mantem RAM)
    .byte $E8, $00           ; MOV A,#0
    .byte $8D, $00           ; MOV Y,#0
spcloop:
    .byte $EC, $FD, $00      ; MOV Y,!$00FD
    .byte $F0, $FB           ; BEQ spcloop
    .byte $BC                ; INC A
    .byte $C4, $F4           ; MOV $F4,A
    .byte $CB, $F5           ; MOV $F5,Y
    .byte $2F, $F4           ; BRA spcloop
spcend:

.segment "HEADER"
    .byte "FORJA65 APU SYNC     "
.segment "ROMINFO"
    .byte $20, $00, $07, $00, $01, $00, $00
    .word $FFFF, $0000
.segment "VECTORS"
    .word 0,0,0,0,0,0,0,0
    .word 0,0,0,0,0,0, reset, 0
