# DKC3 v0.90.0 + Forja65 v0.3.58

Quatro callbacks originais novos do comando 0 foram traduzidos e comparados com a ROM. O comando 0 passa de **17/22 para 21/22 destinos**; o total continua em **22/25 handlers inteiros**, com comandos 0, 3 e 4 ainda condicionais. Não houve promoção artificial para 23/25.

| Callback | Comportamento verificado | Casos aceitos |
| --- | --- | ---: |
| `$B9:B08A` | Sincronização dos Kongs, flags/direção e fim de timestop; chamadas B8/BB executadas originalmente no oráculo | 500 |
| `$B9:B3D2` | Dois descritores FF, escrita byte em `$0473` e seleção de tabelas FD para os registros lógicos de vídeo | 530 |
| `$B9:B662` | RNG, cursor preservado ou `+3` com wrap, cálculo com carry da segunda ASL e saída condicional | 544 |
| `$B9:B68B` | Mesma família de RNG/cursor, com base própria do resultado | 544 |

Os dois callbacks de RNG incluem, cada um, 140 casos aceitos de cursor `+3` e 404 de cursor preservado. Os três caminhos originais foram executados. Continuar e encerrar o update também são comparados; uma igualdade apenas do campo alterado não é suficiente.

A revisão independente encontrou um erro de alias em B3D2: o primeiro store podia alterar `$7E`, `$72` ou o ponteiro usado pelo helper seguinte. A correção conserva a ordem original e relê os dados compartilhados a cada helper. O caso falhou antes da correção e passou no oráculo recompilado, junto das variantes de owner `$0076/$006A/$0062/$0074`. Todas as mutações de um callback rejeitado continuam sendo descartadas.

## O que falta no comando 0

`$B9:BA29` permanece sem tradução autorizada. Seus caminhos com `$5C` não zero saltam para os epílogos do comando 0. Com `$5C` zero, chama B84C/BB8591 e termina em `RTS`; o comando 0 entrou por `JMP ($42)` e preservou o cursor no topo da pilha. A compatibilidade dessa rota exige recuperar o contexto e o contrato de retorno antes de compor a desalocação. A leitura está em `docs/ROM-COMMAND0-v090-WORKBENCH.md`. Isto identifica uma obrigação de prova, não declara um bug na ROM.

## Forja65 junto

O novo contrato genérico `cursor_effects` exige `cursor_effect_cases` com execução original, classes únicas, contagens inteiras positivas e uma partição exata do total de casos aceitos. Aplica-se tanto a proofs quanto a especializações de handlers. Evidência ausente, classe omitida/duplicada, soma divergente ou apenas execução nativa são rejeitadas. Exemplos anteriores continuam aceitos sem esse campo; a evidência nova está no exemplo `examples/dkc3-v090`.

A fila de dependências pendentes passou de 65 para 61. Ela auxilia o fechamento; não autoriza execução por si só.

## Cobertura e limites

- **113 callbacks originais**, antes 109; **31.383 comparações compostas aceitas** e 2.377 rejeições de guards.
- **22/25 handlers inteiros**, 25.376 casos; **43/97 folhas externas**, 242/368 hits.
- Comando 0: 362 hits estruturalmente elegíveis, antes 356.
- Comandos 3+4: 889/1.490 hits elegíveis, sem mudança nesta rodada.
- União de handlers inteiros e rotas condicionais: 7.107/7.709 hits elegíveis, antes 7.101. Handlers inteiros sozinhos: 5.856/7.709.

Hits são ocorrências na gramática estática fechada. O acesso nativo ainda depende dos guards concretos de estado, ponteiro e perfil. Não representam frequência de gameplay, FPS ou fidelidade completa do jogo. Os números de callbacks originais, ABIs antigos de callbacks e folhas externas têm escopos próprios; não devem ser somados como handlers completos.

Os perfis FF/FD exigem a ROM revisada e são imutáveis após carregar. Descritores indiretos continuam limitados a FF. B7:D7FB aqui atualiza palavras lógicas de WRAM; esta entrega não fecha PPU, renderer ou sincronização de hardware.

## Verificação da entrega

**Resultado final: 51/51 testes nativos e 100/100 testes Forja65 aprovados.** A evidência final da suíte fica em `docs/validation/dkc-v090-release-suite.json` e `forja-v0358-suite.json`, nos dois pacotes. A execução usa Linux/GCC Debug e o oráculo nativo produzido pelo CMake, inclusive com `CXX=missing-g++` nos testes Python. Não foi executado um build Windows/MSVC nesta rodada.

Os 455 arquivos de ROM/assets foram comparados byte a byte com v0.89 e preservados. SHA256 da ROM: `2277a2d8dddb01fe5cb0ae9a0fa225d42b3a11adccaeafa18e3c339b3794a32b`. A campanha e os replays por input permanecem na suíte, sem injeção de posição, velocidade, vida ou inventário.

Próximo fechamento: contrato de `$B9:BA29` e sua desalocação/retorno; depois continuar as dependências dos comandos 3 e 4 para chegar aos 25 antes da etapa PPU.
