# DKC3 v0.88.0 + Forja65 v0.3.56 — inicialização de animação limitada e comprovada

Esta versão continua a consolidação anterior e incorpora a campanha DKC3 v0.87 Skidda's Row. O salto desta rodada fecha quatro folhas externas por tradução real de B9:A000 e B5:8006, preservando o que já funcionava.

| Resultado | Antes | Agora |
| --- | --- | --- |
| Handlers completos | 21/25 | 21/25 |
| Folhas externas equivalentes | 39/97 | 43/97 |
| Hits nativos nas folhas externas | 162/368 | 242/368 |
| Comandos 3+4, união elegível sob guardas | 806/1490 | 886/1490 (59,5%) |
| Todos os comandos, hits elegíveis sob guardas | 6985/7709 | 7065/7709 (91,6%) |

Esses hits são ocorrências na gramática estática dos scripts, com requisitos reais de ABI, perfil e ponteiros. Não medem FPS, frequência de gameplay ou fidelidade do jogo inteiro. Os quatro handlers 0, 3, 4 e 6 continuam parciais (8 é alias de 6); os 25 ainda não foram fechados.

## Implementação concreta

- B9:A000 executa a leitura do diretório F9, reset dos campos e o primeiro update de animação. O domínio comprovado tem cinco IDs: $01C9, $01CB, $0204, $023C, $0252. O prefixo usa os handlers originais 12/14 já comprovados e chega ao primeiro frame. IDs, comandos indiretos/recursivos e rotas fora desse domínio continuam rejeitados. Há limite de execução, guarda de janela do sprite e cursor válido da fila sonora; rejeição preserva o estado anterior.
- B5:8006 preserva o carry de entrada, a semente original, a divisão unsigned do SNES (inclusive divisor zero), o escalonamento por shifts e a preservação de $1A. Não foi substituído por um gerador aleatório diferente.
- B6:F9EF, B6:FA7E, B6:FA90 e B6:F8AF executam o caminho real até RTL, incluindo inicialização e RNG quando aplicáveis. A primeira é o antigo maior alvo de 42 hits. As quatro acrescentam 80 hits.
- O retorno passa pelo wrapper real do comando 4: após troca de animação, o novo cursor e a continuação original são preservados. Uma falha posterior ao RNG ou ao prefixo desfaz toda a operação.

B9:A000 **não está comprovado para todos os IDs nem para scripts arbitrários**. A API e as provas mantêm esse limite explícito. Nenhum emulador CPU/PPU foi acrescentado ao runtime; o interpretador limitado de bytes originais continua sendo ferramenta Python de desenvolvimento.

## Melhoria genérica no Forja65

`contract.input_values` e `verification.input_values` definem o mesmo domínio de entrada comprovado. Cada chamador usa `required_input_values`; entrada desconhecida ou fora do domínio bloqueia o fechamento da dependência. Um domínio indireto reduzido só é aceito em `dependency-abi`, com evidência original completa por entrada (`input_target_cases`), casos por alvo consistentes e fingerprints de código/dados. A regra é genérica, sem endereços DKC3 fixos no validador.

A revisão independente reproduziu duas falhas na primeira implementação: uma especialização podia omitir valores exigidos por uma dependência comum; alternativas indiretas não selecionadas eram tratadas como comuns. Ambas foram corrigidas, cobertas por regressões e re-revisadas. Não restaram achados importantes ou críticos na revisão.

## Validação

- DKC3: **51/51 testes**, reunindo a suíte completa, quatro repetições após falha ambiental de início/permissão dos executáveis e três verificações finais de dispatch/oráculo após regeneração.
- Forja65: **98/98 testes** na suíte final.
- Original ROM vs C++: **480 inicializações, 3328 casos de RNG, 384 casos das quatro folhas e 384 execuções compostas pela autorização do comando 4**.
- **15 rejeições de guarda** verificam rollback, entrada inválida, ponteiro inválido, perfil ausente, comando desconhecido, loop e cursor sonoro inválido.
- Os 23184 casos dos 21 handlers completos e os oráculos anteriores de callbacks continuam passando.
- **453 arquivos de ROM/assets são idênticos à campanha v0.87 Skidda's Row**. ROM SHA256: 2277a2d8dddb01fe5cb0ae9a0fa225d42b3a11adccaeafa18e3c339b3794a32b.

O build/teste foi Linux/GCC Debug. Os testes de oráculo Python usaram o artefato CMake com CXX=missing-g++, preservando a correção do WinError 2. Windows/MSVC não foi executado neste ambiente.

## Campanha e próximos bloqueios

Preservado o caminho por input: Publisher → Studio → Title → New Save → Northern Kremisphere → Lake Orangatanga → Lakeside Limbo → Doorstop Dash → Tidal Trouble → Skidda's Row → Murky Mill bloqueada. Skidda's Row continua concluível por Dixie/Kiddy, com runtime ROM-free; sua fidelidade continua parcial (BG2/parallax, inimigos e detalhes específicos pendentes).

As quatro folhas desta rodada saíram da fila de bloqueios auditados. O próximo alvo de folha por impacto é B6:F8CB (10 hits), que exige analisar o contrato B6:F913 e o ID de animação dependente do estado. Fora desta frente, Murky Mill continua o bloqueio duro da campanha; PPU completo e fechamento dos quatro handlers restantes continuam pendentes.

Os arquivos `docs/validation` contêm os resultados, os XMLs e os logs. `docs/ANIMATION-INITIALIZATION-PROOF-v088.json` registra os domínios e evidências; os relatórios WORKBENCH foram lidos da ROM antes da tradução.
