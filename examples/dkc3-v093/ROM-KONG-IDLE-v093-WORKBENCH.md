# ROM B9A683..B9A6A0

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A673 — entry M/X hint `0,0`; not an exit proof.

```text
B9A683  A6 70       LDX $70                  CODE_B9A683
B9A685  20 25 A6    JSR $A625                
B9A688  F0 13       BEQ $B9A69D              
B9A68A  C9 02 00    CMP #$0002               
B9A68D  D0 0D       BNE $B9A69C              
B9A68F  B5 2A       LDA $2A,X                
B9A691  10 04       BPL $B9A697              
B9A693  49 FF FF    EOR #$FFFF               
B9A696  1A          INC A                    
B9A697  C9 20 00    CMP #$0020               CODE_B9A697
B9A69A  90 01       BCC $B9A69D              
B9A69C  60          RTS                      CODE_B9A69C
B9A69D  4C F2 A6    JMP $A6F2                CODE_B9A69D
```

## References

- JSR at `B9A685` to `B9A625` CODE_B9A625
- BEQ at `B9A688` to `B9A69D` CODE_B9A69D
- BNE at `B9A68D` to `B9A69C` CODE_B9A69C
- BPL at `B9A691` to `B9A697` CODE_B9A697
- BCC at `B9A69A` to `B9A69D` CODE_B9A69D
- JMP at `B9A69D` to `B9A6F2` CODE_B9A6F2

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A685 JSR: M/X not assumed to survive; next variable length needs boundary evidence.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A6F2..B9A753

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A6F2 — entry M/X hint `0,0`; not an exit proof.

```text
B9A6F2  A6 70       LDX $70                  CODE_B9A6F2
B9A6F4  A5 7E       LDA $7E                  
B9A6F6  D0 31       BNE $B9A729              
B9A6F8  AD 6B 18    LDA $186B                
B9A6FB  D0 0D       BNE $B9A70A              
B9A6FD  A9 01 00    LDA #$0001               
B9A700  95 38       STA $38,X                
B9A702  A9 01 00    LDA #$0001               
B9A705  22 AC A0 B9 JSL $B9A0AC              
B9A709  60          RTS                      
B9A70A  CD FD 04    CMP $04FD                CODE_B9A70A
B9A70D  F0 0D       BEQ $B9A71C              
B9A70F  A9 10 00    LDA #$0010               
B9A712  95 38       STA $38,X                
B9A714  A9 11 00    LDA #$0011               
B9A717  22 AC A0 B9 JSL $B9A0AC              
B9A71B  60          RTS                      
B9A71C  A9 3F 00    LDA #$003F               CODE_B9A71C
B9A71F  95 38       STA $38,X                
B9A721  A9 2B 00    LDA #$002B               
B9A724  22 AC A0 B9 JSL $B9A0AC              
B9A728  60          RTS                      
B9A729  AD 6B 18    LDA $186B                CODE_B9A729
B9A72C  D0 18       BNE $B9A746              
B9A72E  9B          TXY                      
B9A72F  A5 7E       LDA $7E                  
B9A731  38          SEC                      
B9A732  E9 34 02    SBC #$0234               
B9A735  AA          TAX                      
B9A736  BF 53 A7 B9 LDA $B9A753,X            
B9A73A  99 38 00    STA $0038,Y              
B9A73D  BF 55 A7 B9 LDA $B9A755,X            
B9A741  22 67 A0 B9 JSL $B9A067              
B9A745  60          RTS                      
B9A746  A9 26 00    LDA #$0026               CODE_B9A746
B9A749  95 38       STA $38,X                
B9A74B  A9 00 00    LDA #$0000               
B9A74E  22 67 A0 B9 JSL $B9A067              
B9A752  60          RTS                      
```

## References

- JMP from `B9A69D` to `B9A6F2`
- JSR from `B9A6EE` to `B9A6F2`
- JMP from `B9A8C6` to `B9A6F2`
- JMP from `B9B206` to `B9A6F2`
- JMP from `B9B497` to `B9A6F2`
- JSR from `B9B4DB` to `B9A6F2`
- JSR from `B9B52F` to `B9A6F2`
- BNE at `B9A6F6` to `B9A729` CODE_B9A729
- BNE at `B9A6FB` to `B9A70A` CODE_B9A70A
- JSL at `B9A705` to `B9A0AC` set_anim_handle_kiddy_direct
- BEQ at `B9A70D` to `B9A71C` CODE_B9A71C
- JSL at `B9A717` to `B9A0AC` set_anim_handle_kiddy_direct
- JSL at `B9A724` to `B9A0AC` set_anim_handle_kiddy_direct
- BNE at `B9A72C` to `B9A746` CODE_B9A746
- JSL at `B9A741` to `B9A067` CODE_B9A067
- JSL at `B9A74E` to `B9A067` CODE_B9A067
- Long operand `B9A753` at `B9A736`; indexed=True. Size/payload type still require review.
- Long operand `B9A755` at `B9A73D`; indexed=True. Size/payload type still require review.

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A705 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A717 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A724 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A741 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A74E JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A625..B9A666

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A625 — entry M/X hint `0,0`; not an exit proof.

```text
B9A625  B5 30       LDA $30,X                CODE_B9A625
B9A627  D0 10       BNE $B9A639              
B9A629  B5 2A       LDA $2A,X                
B9A62B  D0 04       BNE $B9A631              
B9A62D  A9 00 00    LDA #$0000               
B9A630  60          RTS                      
B9A631  A9 02 00    LDA #$0002               CODE_B9A631
B9A634  60          RTS                      
B9A635  A9 04 00    LDA #$0004               CODE_B9A635
B9A638  60          RTS                      
B9A639  10 04       BPL $B9A63F              CODE_B9A639
B9A63B  49 FF FF    EOR #$FFFF               
B9A63E  1A          INC A                    
B9A63F  85 1A       STA $1A                  CODE_B9A63F
B9A641  B5 2A       LDA $2A,X                
B9A643  F0 F0       BEQ $B9A635              
B9A645  10 04       BPL $B9A64B              
B9A647  49 FF FF    EOR #$FFFF               
B9A64A  1A          INC A                    
B9A64B  C5 1A       CMP $1A                  CODE_B9A64B
B9A64D  90 06       BCC $B9A655              
B9A64F  F0 08       BEQ $B9A659              
B9A651  A9 06 00    LDA #$0006               
B9A654  60          RTS                      
B9A655  A9 08 00    LDA #$0008               CODE_B9A655
B9A658  60          RTS                      
B9A659  A9 0A 00    LDA #$000A               CODE_B9A659
B9A65C  60          RTS                      
B9A65D  A6 70       LDX $70                  CODE_B9A65D
B9A65F  20 25 A6    JSR $A625                
B9A662  AA          TAX                      
B9A663  7C 66 A6    JMP ($A666,X)            
```

## References

- JSR from `B9A65F` to `B9A625`
- JSR from `B9A685` to `B9A625`
- JSR from `B9A6A5` to `B9A625`
- JSR from `B9A6CC` to `B9A625`
- JSR from `B9A8B2` to `B9A625`
- BNE at `B9A627` to `B9A639` CODE_B9A639
- BNE at `B9A62B` to `B9A631` CODE_B9A631
- BPL at `B9A639` to `B9A63F` CODE_B9A63F
- BEQ at `B9A643` to `B9A635` CODE_B9A635
- BPL at `B9A645` to `B9A64B` CODE_B9A64B
- BCC at `B9A64D` to `B9A655` CODE_B9A655
- BEQ at `B9A64F` to `B9A659` CODE_B9A659
- JSR at `B9A65F` to `B9A625` CODE_B9A625
- Indirect contract (metadata): `indirect_dispatch A663 2 ptrtail targets:B9A672,B9A673`
- Indirect contract (metadata): `ROM-verified table DATA_B9A666 at B9A666; 6 targets, stride=2; index bounds not proven`

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A65F JSR: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A663: indirect control flow; target set requires a reviewed dispatch contract or RAM state.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A672..B9A683

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A672 — entry M/X hint `0,0`; not an exit proof.

```text
B9A672  60          RTS                      CODE_B9A672
B9A673  A4 72       LDY $72                  CODE_B9A673
B9A675  B9 06 00    LDA $0006,Y              
B9A678  29 04 00    AND #$0004               
B9A67B  D0 03       BNE $B9A680              
B9A67D  4C 63 A7    JMP $A763                
B9A680  4C D4 A7    JMP $A7D4                CODE_B9A680
```

## References

- BNE at `B9A67B` to `B9A680` CODE_B9A680
- JMP at `B9A67D` to `B9A763` CODE_B9A763
- JMP at `B9A680` to `B9A7D4` CODE_B9A7D4

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A6A0..B9A6AD

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A673 — entry M/X hint `0,0`; not an exit proof.

```text
B9A6A0  20 33 A8    JSR $A833                CODE_B9A6A0
B9A6A3  B0 21       BCS $B9A6C6              
B9A6A5  20 25 A6    JSR $A625                
B9A6A8  9B          TXY                      
B9A6A9  AA          TAX                      
B9A6AA  7C AD A6    JMP ($A6AD,X)            
```

## References

- JSR at `B9A6A0` to `B9A833` CODE_B9A833
- BCS at `B9A6A3` to `B9A6C6` CODE_B9A6C6
- JSR at `B9A6A5` to `B9A625` CODE_B9A625
- Indirect contract (metadata): `indirect_dispatch A6AA 2 ptrtail targets:B9A6C6,B9A6B9`
- Indirect contract (metadata): `ROM-verified table DATA_B9A6AD at B9A6AD; 6 targets, stride=2; index bounds not proven`

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A6A0 JSR: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A6A5 JSR: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A6AA: indirect control flow; target set requires a reviewed dispatch contract or RAM state.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A6B9..B9A6D4

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A6B9 — entry M/X hint `0,0`; not an exit proof.

```text
B9A6B9  A4 72       LDY $72                  CODE_B9A6B9
B9A6BB  B9 06 00    LDA $0006,Y              
B9A6BE  29 04 00    AND #$0004               
B9A6C1  F0 03       BEQ $B9A6C6              
B9A6C3  4C D4 A7    JMP $A7D4                
B9A6C6  60          RTS                      CODE_B9A6C6
B9A6C7  20 33 A8    JSR $A833                CODE_B9A6C7
B9A6CA  B0 21       BCS $B9A6ED              
B9A6CC  20 25 A6    JSR $A625                
B9A6CF  9B          TXY                      
B9A6D0  AA          TAX                      
B9A6D1  7C D4 A6    JMP ($A6D4,X)            
```

## References

- BEQ at `B9A6C1` to `B9A6C6` CODE_B9A6C6
- JMP at `B9A6C3` to `B9A7D4` CODE_B9A7D4
- JSR at `B9A6C7` to `B9A833` CODE_B9A833
- BCS at `B9A6CA` to `B9A6ED` CODE_B9A6ED
- JSR at `B9A6CC` to `B9A625` CODE_B9A625
- Indirect contract (metadata): `indirect_dispatch A6D1 2 ptrtail targets:B9A6ED,B9A6E0`
- Indirect contract (metadata): `ROM-verified table DATA_B9A6D4 at B9A6D4; 6 targets, stride=2; index bounds not proven`

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A6C7 JSR: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A6CC JSR: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A6D1: indirect control flow; target set requires a reviewed dispatch contract or RAM state.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A6E0..B9A6EE

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A6E0 — entry M/X hint `0,0`; not an exit proof.

```text
B9A6E0  A4 72       LDY $72                  CODE_B9A6E0
B9A6E2  B9 06 00    LDA $0006,Y              
B9A6E5  29 04 00    AND #$0004               
B9A6E8  D0 03       BNE $B9A6ED              
B9A6EA  4C 63 A7    JMP $A763                
B9A6ED  60          RTS                      CODE_B9A6ED
```

## References

- BNE at `B9A6E8` to `B9A6ED` CODE_B9A6ED
- JMP at `B9A6EA` to `B9A763` CODE_B9A763

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A763..B9A7C4

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A6F2 — entry M/X hint `0,0`; not an exit proof.

```text
B9A763  A6 70       LDX $70                  CODE_B9A763
B9A765  A5 7E       LDA $7E                  
B9A767  D0 31       BNE $B9A79A              
B9A769  AD 6B 18    LDA $186B                
B9A76C  D0 0D       BNE $B9A77B              
B9A76E  A9 01 00    LDA #$0001               
B9A771  95 38       STA $38,X                
B9A773  A9 02 00    LDA #$0002               
B9A776  22 AC A0 B9 JSL $B9A0AC              
B9A77A  60          RTS                      
B9A77B  CD FD 04    CMP $04FD                CODE_B9A77B
B9A77E  F0 0D       BEQ $B9A78D              
B9A780  A9 10 00    LDA #$0010               
B9A783  95 38       STA $38,X                
B9A785  A9 12 00    LDA #$0012               
B9A788  22 AC A0 B9 JSL $B9A0AC              
B9A78C  60          RTS                      
B9A78D  A9 3F 00    LDA #$003F               CODE_B9A78D
B9A790  95 38       STA $38,X                
B9A792  A9 2C 00    LDA #$002C               
B9A795  22 AC A0 B9 JSL $B9A0AC              
B9A799  60          RTS                      
B9A79A  AD 6B 18    LDA $186B                CODE_B9A79A
B9A79D  D0 18       BNE $B9A7B7              
B9A79F  9B          TXY                      
B9A7A0  A5 7E       LDA $7E                  
B9A7A2  38          SEC                      
B9A7A3  E9 34 02    SBC #$0234               
B9A7A6  AA          TAX                      
B9A7A7  BF C4 A7 B9 LDA $B9A7C4,X            
B9A7AB  99 38 00    STA $0038,Y              
B9A7AE  BF C6 A7 B9 LDA $B9A7C6,X            
B9A7B2  22 67 A0 B9 JSL $B9A067              
B9A7B6  60          RTS                      
B9A7B7  A9 26 00    LDA #$0026               CODE_B9A7B7
B9A7BA  95 38       STA $38,X                
B9A7BC  A9 01 00    LDA #$0001               
B9A7BF  22 67 A0 B9 JSL $B9A067              
B9A7C3  60          RTS                      
```

## References

- JMP from `B9A67D` to `B9A763`
- JMP from `B9A6EA` to `B9A763`
- JMP from `B9A8D3` to `B9A763`
- BNE at `B9A767` to `B9A79A` CODE_B9A79A
- BNE at `B9A76C` to `B9A77B` CODE_B9A77B
- JSL at `B9A776` to `B9A0AC` set_anim_handle_kiddy_direct
- BEQ at `B9A77E` to `B9A78D` CODE_B9A78D
- JSL at `B9A788` to `B9A0AC` set_anim_handle_kiddy_direct
- JSL at `B9A795` to `B9A0AC` set_anim_handle_kiddy_direct
- BNE at `B9A79D` to `B9A7B7` CODE_B9A7B7
- JSL at `B9A7B2` to `B9A067` CODE_B9A067
- JSL at `B9A7BF` to `B9A067` CODE_B9A067
- Long operand `B9A7C4` at `B9A7A7`; indexed=True. Size/payload type still require review.
- Long operand `B9A7C6` at `B9A7AE`; indexed=True. Size/payload type still require review.

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A776 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A788 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A795 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A7B2 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A7BF JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A7D4..B9A833

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A6F2 — entry M/X hint `0,0`; not an exit proof.

```text
B9A7D4  A6 70       LDX $70                  CODE_B9A7D4
B9A7D6  A5 7E       LDA $7E                  
B9A7D8  D0 1F       BNE $B9A7F9              
B9A7DA  AD 6B 18    LDA $186B                
B9A7DD  D0 0D       BNE $B9A7EC              
B9A7DF  A9 01 00    LDA #$0001               
B9A7E2  95 38       STA $38,X                
B9A7E4  A9 04 00    LDA #$0004               
B9A7E7  22 AC A0 B9 JSL $B9A0AC              
B9A7EB  60          RTS                      
B9A7EC  A9 10 00    LDA #$0010               CODE_B9A7EC
B9A7EF  95 38       STA $38,X                
B9A7F1  A9 12 00    LDA #$0012               
B9A7F4  22 AC A0 B9 JSL $B9A0AC              
B9A7F8  60          RTS                      
B9A7F9  AD 6B 18    LDA $186B                CODE_B9A7F9
B9A7FC  D0 18       BNE $B9A816              
B9A7FE  9B          TXY                      
B9A7FF  A5 7E       LDA $7E                  
B9A801  38          SEC                      
B9A802  E9 34 02    SBC #$0234               
B9A805  AA          TAX                      
B9A806  BF 23 A8 B9 LDA $B9A823,X            
B9A80A  99 38 00    STA $0038,Y              
B9A80D  BF 25 A8 B9 LDA $B9A825,X            
B9A811  22 67 A0 B9 JSL $B9A067              
B9A815  60          RTS                      
B9A816  A9 26 00    LDA #$0026               CODE_B9A816
B9A819  95 38       STA $38,X                
B9A81B  A9 02 00    LDA #$0002               
B9A81E  22 67 A0 B9 JSL $B9A067              
B9A822  60          RTS                      
```

## References

- JMP from `B9A680` to `B9A7D4`
- JMP from `B9A6C3` to `B9A7D4`
- JMP from `B9A8D6` to `B9A7D4`
- BNE at `B9A7D8` to `B9A7F9` CODE_B9A7F9
- BNE at `B9A7DD` to `B9A7EC` CODE_B9A7EC
- JSL at `B9A7E7` to `B9A0AC` set_anim_handle_kiddy_direct
- JSL at `B9A7F4` to `B9A0AC` set_anim_handle_kiddy_direct
- BNE at `B9A7FC` to `B9A816` CODE_B9A816
- JSL at `B9A811` to `B9A067` CODE_B9A067
- JSL at `B9A81E` to `B9A067` CODE_B9A067
- Long operand `B9A823` at `B9A806`; indexed=True. Size/payload type still require review.
- Long operand `B9A825` at `B9A80D`; indexed=True. Size/payload type still require review.

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A7E7 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A7F4 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A811 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A81E JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- DATA boundary at B9A823; use table command, not code decoding.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A833..B9A8A3

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A833 — entry M/X hint `0,0`; not an exit proof.

```text
B9A833  A6 70       LDX $70                  CODE_B9A833
B9A835  B5 30       LDA $30,X                
B9A837  F0 08       BEQ $B9A841              
B9A839  4A          LSR A                    
B9A83A  55 1E       EOR $1E,X                
B9A83C  29 00 40    AND #$4000               
B9A83F  D0 02       BNE $B9A843              
B9A841  18          CLC                      CODE_B9A841
B9A842  60          RTS                      
B9A843  A5 7E       LDA $7E                  CODE_B9A843
B9A845  D0 25       BNE $B9A86C              
B9A847  AD 6B 18    LDA $186B                
B9A84A  D0 09       BNE $B9A855              
B9A84C  A9 03 00    LDA #$0003               
B9A84F  22 AC A0 B9 JSL $B9A0AC              
B9A853  38          SEC                      
B9A854  60          RTS                      
B9A855  CD FD 04    CMP $04FD                CODE_B9A855
B9A858  F0 09       BEQ $B9A863              
B9A85A  A9 13 00    LDA #$0013               
B9A85D  22 AC A0 B9 JSL $B9A0AC              
B9A861  38          SEC                      
B9A862  60          RTS                      
B9A863  A9 2D 00    LDA #$002D               CODE_B9A863
B9A866  22 AC A0 B9 JSL $B9A0AC              
B9A86A  38          SEC                      
B9A86B  60          RTS                      
B9A86C  AD 6B 18    LDA $186B                CODE_B9A86C
B9A86F  D0 08       BNE $B9A879              
B9A871  A9 03 00    LDA #$0003               
B9A874  22 67 A0 B9 JSL $B9A067              
B9A878  60          RTS                      
B9A879  A5 7E       LDA $7E                  CODE_B9A879
B9A87B  C9 3C 02    CMP #$023C               
B9A87E  F0 1B       BEQ $B9A89B              
B9A880  A6 70       LDX $70                  
B9A882  B5 1E       LDA $1E,X                
B9A884  49 00 40    EOR #$4000               
B9A887  95 1E       STA $1E,X                
B9A889  AE 6B 18    LDX $186B                
B9A88C  B5 1E       LDA $1E,X                
B9A88E  49 00 40    EOR #$4000               
B9A891  95 1E       STA $1E,X                
B9A893  A9 01 00    LDA #$0001               
B9A896  22 67 A0 B9 JSL $B9A067              
B9A89A  60          RTS                      
B9A89B  A9 0C 00    LDA #$000C               CODE_B9A89B
B9A89E  22 67 A0 B9 JSL $B9A067              
B9A8A2  60          RTS                      
```

## References

- JSR from `B9A6A0` to `B9A833`
- JSR from `B9A6C7` to `B9A833`
- JSR from `B9AD46` to `B9A833`
- JSR from `B9B525` to `B9A833`
- JMP from `B9B559` to `B9A833`
- BEQ at `B9A837` to `B9A841` CODE_B9A841
- BNE at `B9A83F` to `B9A843` CODE_B9A843
- BNE at `B9A845` to `B9A86C` CODE_B9A86C
- BNE at `B9A84A` to `B9A855` CODE_B9A855
- JSL at `B9A84F` to `B9A0AC` set_anim_handle_kiddy_direct
- BEQ at `B9A858` to `B9A863` CODE_B9A863
- JSL at `B9A85D` to `B9A0AC` set_anim_handle_kiddy_direct
- JSL at `B9A866` to `B9A0AC` set_anim_handle_kiddy_direct
- BNE at `B9A86F` to `B9A879` CODE_B9A879
- JSL at `B9A874` to `B9A067` CODE_B9A067
- BEQ at `B9A87E` to `B9A89B` CODE_B9A89B
- JSL at `B9A896` to `B9A067` CODE_B9A067
- JSL at `B9A89E` to `B9A067` CODE_B9A067

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A84F JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A85D JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A866 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A874 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A896 JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- B9A89E JSL: M/X not assumed to survive; next variable length needs boundary evidence.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A0AC..B9A0E2

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: set_anim_handle_kiddy_direct — entry M/X hint `0,0`; not an exit proof.

```text
B9A0AC  A4 72       LDY $72                  set_anim_handle_kiddy_direct
B9A0AE  99 00 00    STA $0000,Y              
B9A0B1  C0 80 14    CPY #$1480               
B9A0B4  F0 04       BEQ $B9A0BA              
B9A0B6  18          CLC                      
B9A0B7  69 87 00    ADC #$0087               
B9A0BA  8B          PHB                      CODE_B9A0BA
B9A0BB  F4 01 F9    PEA $F901                
B9A0BE  AB          PLB                      
B9A0BF  AB          PLB                      
B9A0C0  A6 70       LDX $70                  
B9A0C2  95 40       STA $40,X                
B9A0C4  0A          ASL A                    
B9A0C5  0A          ASL A                    
B9A0C6  A8          TAY                      
B9A0C7  B5 4A       LDA $4A,X                
B9A0C9  29 00 80    AND #$8000               
B9A0CC  19 02 01    ORA $0102,Y              
B9A0CF  95 4A       STA $4A,X                
B9A0D1  B9 00 01    LDA $0100,Y              
B9A0D4  95 46       STA $46,X                
B9A0D6  A8          TAY                      
B9A0D7  A9 00 01    LDA #$0100               
B9A0DA  95 44       STA $44,X                
B9A0DC  74 42       STZ $42,X                
B9A0DE  74 48       STZ $48,X                
B9A0E0  80 38       BRA $B9A11A              
```

## References

- JMP from `B9A009` to `B9A0AC`
- JSL from `B9A059` to `B9A0AC`
- BRA from `B9A076` to `B9A0AC`
- BNE from `B9A08E` to `B9A0AC`
- JSL from `B9A0A1` to `B9A0AC`
- JMP from `B9A254` to `B9A0AC`
- JSL from `B9A61B` to `B9A0AC`
- JSL from `B9A705` to `B9A0AC`
- JSL from `B9A717` to `B9A0AC`
- JSL from `B9A724` to `B9A0AC`
- JSL from `B9A776` to `B9A0AC`
- JSL from `B9A788` to `B9A0AC`
- JSL from `B9A795` to `B9A0AC`
- JSL from `B9A7E7` to `B9A0AC`
- JSL from `B9A7F4` to `B9A0AC`
- JSL from `B9A84F` to `B9A0AC`
- JSL from `B9A85D` to `B9A0AC`
- JSL from `B9A866` to `B9A0AC`
- JSL from `B9A8F1` to `B9A0AC`
- JSL from `B9A919` to `B9A0AC`
- JSL from `B9AC10` to `B9A0AC`
- JSL from `B9AC4B` to `B9A0AC`
- JSL from `B9ACB5` to `B9A0AC`
- JSL from `B9ACCC` to `B9A0AC`
- JSL from `B9AD1C` to `B9A0AC`
- JSL from `B9AFC8` to `B9A0AC`
- BEQ at `B9A0B4` to `B9A0BA` CODE_B9A0BA
- BRA at `B9A0E0` to `B9A11A` CODE_B9A11A

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A0BE PLB: DBR/direct-page context changes; short memory addresses are not resolved as ROM tables.
- B9A0BF PLB: DBR/direct-page context changes; short memory addresses are not resolved as ROM tables.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A11A..B9A15A

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A101 — entry M/X hint `0,0`; not an exit proof.

```text
B9A11A  88          DEY                      CODE_B9A11A
B9A11B  B9 00 00    LDA $0000,Y              
B9A11E  30 2F       BMI $B9A14F              
B9A120  C8          INY                      
B9A121  C8          INY                      
B9A122  29 00 FF    AND #$FF00               
B9A125  18          CLC                      
B9A126  75 42       ADC $42,X                
B9A128  95 42       STA $42,X                
B9A12A  10 04       BPL $B9A130              
B9A12C  C8          INY                      
B9A12D  C8          INY                      
B9A12E  80 EA       BRA $B9A11A              
B9A130  B9 00 00    LDA $0000,Y              CODE_B9A130
B9A133  95 24       STA $24,X                
B9A135  C8          INY                      
B9A136  C8          INY                      
B9A137  98          TYA                      
B9A138  95 46       STA $46,X                
B9A13A  AB          PLB                      CODE_B9A13A
B9A13B  B5 48       LDA $48,X                CODE_B9A13B
B9A13D  D0 01       BNE $B9A140              
B9A13F  6B          RTL                      
B9A140  8B          PHB                      CODE_B9A140
B9A141  4B          PHK                      
B9A142  AB          PLB                      
B9A143  DA          PHX                      
B9A144  85 42       STA $42                  
B9A146  F4 4B A1    PEA $A14B                
B9A149  6C 42 00    JMP ($0042)              
B9A14C  FA          PLX                      CODE_B9A14C
B9A14D  AB          PLB                      
B9A14E  6B          RTL                      
B9A14F  C8          INY                      CODE_B9A14F
B9A150  C8          INY                      
B9A151  EB          XBA                      
B9A152  29 7F 00    AND #$007F               
B9A155  0A          ASL A                    
B9A156  AA          TAX                      
B9A157  7C 5A A1    JMP ($A15A,X)            
```

## References

- BRA from `B9A0E0` to `B9A11A`
- BRA from `B9A12E` to `B9A11A`
- BRL from `B9A19D` to `B9A11A`
- BRL from `B9A1B4` to `B9A11A`
- JMP from `B9A1DB` to `B9A11A`
- JMP from `B9A1E4` to `B9A11A`
- JMP from `B9A21B` to `B9A11A`
- JMP from `B9A22F` to `B9A11A`
- JMP from `B9A277` to `B9A11A`
- JMP from `B9A2A7` to `B9A11A`
- JMP from `B9A2CB` to `B9A11A`
- JMP from `B9A2DC` to `B9A11A`
- JMP from `B9A2F0` to `B9A11A`
- JMP from `B9A316` to `B9A11A`
- JMP from `B9A351` to `B9A11A`
- JMP from `B9A384` to `B9A11A`
- JMP from `B9A478` to `B9A11A`
- JMP from `B9A4BB` to `B9A11A`
- JMP from `B9A4FF` to `B9A11A`
- JMP from `B9A545` to `B9A11A`
- BMI at `B9A11E` to `B9A14F` CODE_B9A14F
- BPL at `B9A12A` to `B9A130` CODE_B9A130
- BRA at `B9A12E` to `B9A11A` CODE_B9A11A
- BNE at `B9A13D` to `B9A140` CODE_B9A140
- Indirect contract (metadata): `indirect_dispatch A157 25 ptrtail targets:B9A1A0,B9A1C0,B9A1DE,B9A1FD,B9A1E7,B9A226,B9A232,B9A247,B9A257,B9A286,B9A2B6,B9A2CE,B9A2DF,B9A2F3,B9A319,B9A33F,B9A354,B9A393,B9A3F8,B9A462,B9A4A5,B9A4E9,B9A52F,B9A589,B9A190`
- Indirect contract (metadata): `ROM-verified table DATA_B9A15A at B9A15A; 27 targets, stride=2; index bounds not proven`

## Native source leads (not coverage proof)

- `src/core/RomAnimationHandlers.cpp:452` — // B9:A11A decrements before the word read. The high byte at Y is
- `src/core/RomAnimationHandlers.cpp:476` — // Tail callback at B9:A149 is not covered by this bounded initializer ABI.

## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- B9A13A PLB: DBR/direct-page context changes; short memory addresses are not resolved as ROM tables.
- B9A142 PLB: DBR/direct-page context changes; short memory addresses are not resolved as ROM tables.
- B9A149: indirect control flow; target set requires a reviewed dispatch contract or RAM state.
- B9A14D PLB: DBR/direct-page context changes; short memory addresses are not resolved as ROM tables.
- B9A157: indirect control flow; target set requires a reviewed dispatch contract or RAM state.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A226..B9A232

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A226 — entry M/X hint `0,0`; not an exit proof.

```text
B9A226  A6 70       LDX $70                  CODE_B9A226
B9A228  B9 00 00    LDA $0000,Y              
B9A22B  95 48       STA $48,X                
B9A22D  C8          INY                      
B9A22E  C8          INY                      
B9A22F  4C 1A A1    JMP $A11A                
```

## References

- JMP at `B9A22F` to `B9A11A` CODE_B9A11A

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

# ROM B9A2B6..B9A2CE

Static reading only; no CPU/PPU execution. Bytes and operands come from the current ROM.

Catalog entry: CODE_B9A2B6 — entry M/X hint `0,0`; not an exit proof.

```text
B9A2B6  B9 00 00    LDA $0000,Y              CODE_B9A2B6
B9A2B9  29 FF 00    AND #$00FF               
B9A2BC  18          CLC                      
B9A2BD  65 70       ADC $70                  
B9A2BF  AA          TAX                      
B9A2C0  C8          INY                      
B9A2C1  B9 00 00    LDA $0000,Y              
B9A2C4  C8          INY                      
B9A2C5  C8          INY                      
B9A2C6  94 00       STY $00,X                
B9A2C8  A8          TAY                      
B9A2C9  A6 70       LDX $70                  
B9A2CB  4C 1A A1    JMP $A11A                
```

## References

- JMP at `B9A2CB` to `B9A11A` CODE_B9A11A

## Native source leads (not coverage proof)


## Unknowns and obligations

- Catalog span is a structural entry interval, not proof of a complete routine or exit M/X contract.
- Short memory operands require DBR/direct-page context; a source name or address mention alone does not establish a physical memory address.
- Preserve word wrap, carry/sign flags and memory offsets; verify the C++ with bounded original-routine oracles and input replays.

B9A666 A672
B9A668 A672
B9A66A A673
B9A66C A673
B9A66E A673
B9A670 A673

B9A6AD A6C6
B9A6AF A6C6
B9A6B1 A6B9
B9A6B3 A6B9
B9A6B5 A6B9
B9A6B7 A6B9

B9A6D4 A6ED
B9A6D6 A6ED
B9A6D8 A6E0
B9A6DA A6E0
B9A6DC A6E0
B9A6DE A6E0
