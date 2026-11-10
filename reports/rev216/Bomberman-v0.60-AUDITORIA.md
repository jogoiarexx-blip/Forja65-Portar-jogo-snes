# Super Bomberman 2 v0.60 — resumo da auditoria REV216

A auditoria **registrada no ZIP de fonte** informa rotas compiladas em C++ para CPU 65C816 e SPC700, sem fallback interpretado nos caminhos verificados.

| Rota | Password | Quadros | Fallback CPU v0.60 | Fallback SPC700 v0.60 |
|---|---|---:|---:|---:|
| 1-1 | 4361 | 6.000 | 0 | 0 |
| 2-1 | 6442 | 6.000 | 0 | 0 |
| 3-1 | 3903 | 6.000 | 0 | 0 |
| 4-1 | 9564 | 6.000 | 0 | 0 |
| 5-1 | 7735 | 6.000 | 0 | 0 |
| 1-7 | 1753 | 6.000 | 0 | 0 |
| 2-7 | 2764 | 6.000 | 0 | 0 |
| 3-7 | 3764 | 6.000 | 0 | 0 |
| 4-7 | 4764 | 6.000 | 0 | 0 |
| 5-7 | 5764 | 6.000 | 0 | 0 |
| Referência original | replay | 24.000 | 0 | 0 |

O relatório original informa 76 testes CTest aprovados e um vetor externo opcional ignorado. O EXE foi identificado como PE64, mas **não teve execução em Windows validada** nessa rodada.

### Passwords especiais
- `2764` — 2-7
- `3764` — 3-7
- `4764` — 4-7
- `5764` — 5-7

Os presets especiais incluem seis vidas, fogo 4, três bombas, dois corações extras finitos e chute de bomba, conforme os relatórios do port.

**Limite essencial:** os replays testados não certificam todas as fases e chefes, não eliminam a dependência do runtime SNES e não provam que o jogo inteiro foi convertido para lógica nativa independente de hardware.
