# Cursor and fade callback workbench v092

# ROM B9AB12..B9AB2F

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A8C9 — entry M/X hint `0,0`; not an exit proof.

```text
B9AB12  B5 24       LDA $24,X                CODE_B9AB12
B9AB14  38          SEC                      
B9AB15  E9 BC 0C    SBC #$0CBC               
B9AB18  C9 19 00    CMP #$0019               
B9AB1B  90 01       BCC $B9AB1E              
B9AB1D  60          RTS                      
B9AB1E  A9 1C 15    LDA #$151C               CODE_B9AB1E
B9AB21  4C 21 A2    JMP $A221                
B9AB24  B5 28       LDA $28,X                CODE_B9AB24
B9AB26  29 03 03    AND #$0303               
B9AB29  D0 01       BNE $B9AB2C              
B9AB2B  60          RTS                      
B9AB2C  4C A7 A8    JMP $A8A7                CODE_B9AB2C
```

## References

- BCC at `B9AB1B` to `B9AB1E` CODE_B9AB1E
- JMP at `B9AB21` to `B9A221` CODE_B9A221
- BNE at `B9AB29` to `B9AB2C` CODE_B9AB2C
- JMP at `B9AB2C` to `B9A8A7` CODE_B9A8A7

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A1FD..B9A226

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A1FD — entry M/X hint `0,0`; not an exit proof.

```text
B9A1FD  A6 70       LDX $70                  CODE_B9A1FD
B9A1FF  B9 00 00    LDA $0000,Y              
B9A202  85 42       STA $42                  
B9A204  C8          INY                      
B9A205  C8          INY                      
B9A206  94 46       STY $46,X                
B9A208  5A          PHY                      
B9A209  8B          PHB                      CODE_B9A209
B9A20A  4B          PHK                      
B9A20B  AB          PLB                      
B9A20C  F4 11 A2    PEA $A211                
B9A20F  6C 42 00    JMP ($0042)              
B9A212  AB          PLB                      CODE_B9A212
B9A213  68          PLA                      
B9A214  A6 70       LDX $70                  
B9A216  D5 46       CMP $46,X                
B9A218  D0 04       BNE $B9A21E              
B9A21A  A8          TAY                      
B9A21B  4C 1A A1    JMP $A11A                
B9A21E  4C 3A A1    JMP $A13A                CODE_B9A21E
B9A221  95 46       STA $46,X                CODE_B9A221
B9A223  83 04       STA $04,S                
B9A225  60          RTS                      
```

## References

- BNE at `B9A218` to `B9A21E` CODE_B9A21E
- JMP at `B9A21B` to `B9A11A` CODE_B9A11A
- JMP at `B9A21E` to `B9A13A` CODE_B9A13A

## Native source leads (not coverage proof)

- `src/core/RomAnimationHandlers.h:96` — // pointer in low WRAM and enter it through B9:A20F (JMP ($0042)).  Callback

## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A20B PLB: DBR/direct-page context changes; short memory addresses are not resolved as ROM tables.
- B9A20F: indirect control flow; target set requires a reviewed dispatch contract or RAM state.
- B9A212 PLB: DBR/direct-page context changes; short memory addresses are not resolved as ROM tables.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9AFE7..B9B000

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9AF4B — entry M/X hint `0,0`; not an exit proof.

```text
B9AFE7  EC F9 04    CPX $04F9                CODE_B9AFE7
B9AFEA  D0 13       BNE $B9AFFF              
B9AFEC  A9 0F 82    LDA #$820F               
B9AFEF  22 24 80 80 JSL $808024              
B9AFF3  A9 01 00    LDA #$0001               
B9AFF6  0C AF 05    TSB $05AF                
B9AFF9  A9 FF FF    LDA #$FFFF               
B9AFFC  8D 5B 19    STA $195B                
B9AFFF  60          RTS                      CODE_B9AFFF
```

## References

- BNE at `B9AFEA` to `B9AFFF` CODE_B9AFFF
- JSL at `B9AFEF` to `808024` CODE_808024

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9AFEF JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM 808024..808027

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_808024 — entry M/X hint `0,0`; not an exit proof.

```text
808024  4C 01 85    JMP $8501                CODE_808024
```

## References

- JSL from `B2860D` to `808024`
- JSL from `B2873A` to `808024`
- JSL from `B28AE8` to `808024`
- JSL from `B28D74` to `808024`
- JSL from `B28ED7` to `808024`
- JSL from `B296D1` to `808024`
- JSL from `B29AC0` to `808024`
- JSL from `B2A0E0` to `808024`
- JSL from `B480F1` to `808024`
- JSL from `B4B164` to `808024`
- JSL from `B4B20E` to `808024`
- JSL from `B590D9` to `808024`
- JSL from `B5F116` to `808024`
- JSL from `B5FBA3` to `808024`
- JSL from `B88385` to `808024`
- JSL from `B9AFEF` to `808024`
- JSL from `BBD8A7` to `808024`
- JMP at `808024` to `808501` set_fade

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM 808501..808537

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: set_fade — entry M/X hint `0,0`; not an exit proof.

```text
808501  9C ED 04    STZ $04ED                set_fade
808504  8D EC 04    STA $04EC                
808507  6B          RTL                      
808508  E2 20       SEP #$20                 fade_screen
80850A  AD ED 04    LDA $04ED                
80850D  F0 39       BEQ $808548              
80850F  30 1D       BMI $80852E              
808511  EE EE 04    INC $04EE                
808514  CD EE 04    CMP $04EE                
808517  D0 2F       BNE $808548              
808519  9C EE 04    STZ $04EE                
80851C  EE EC 04    INC $04EC                
80851F  A9 0F       LDA #$0F                 
808521  CD EC 04    CMP $04EC                
808524  B0 22       BCS $808548              
808526  8D EC 04    STA $04EC                
808529  9C ED 04    STZ $04ED                
80852C  80 1A       BRA $808548              
80852E  29 7F       AND #$7F                 
808530  EE EE 04    INC $04EE                
808533  CD EE 04    CMP $04EE                
```

## References

- JMP from `808024` to `808501`
- JSL from `8083F5` to `808501`
- JSL from `8084A8` to `808501`
- JSL from `808E9F` to `808501`
- JSL from `80956D` to `808501`
- JSL from `809DA2` to `808501`
- JSL from `80AA73` to `808501`
- JSL from `80AF2B` to `808501`
- JSL from `80B450` to `808501`
- JSL from `80B89A` to `808501`
- JSL from `80BAC0` to `808501`
- JSL from `80C196` to `808501`
- BEQ at `80850D` to `808548` 
- BMI at `80850F` to `80852E` 
- BNE at `808517` to `808548` 
- BCS at `808524` to `808548` 
- BRA at `80852C` to `808548` 

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- Truncated instruction at 808536
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

