# DKC3 v0.92.0 + Forja65 v0.3.59

Continuação direta dos pacotes enviados DKC3 v0.91.0 e Forja65 v0.3.58, preservando os nove callbacks já fechados.

| Métrica | Base enviada | Esta versão |
|---|---:|---:|
| Callbacks originais validados | 122 | 124 |
| Dependências pendentes | 52 | 50 |
| Handlers completos | 22/25 | 22/25 |
| Comando 0: destinos validados | 21/22 | 21/22 |
| Ocorrências elegíveis, comandos 3+4 | 932/1.490 | 943/1.490 |
| União de ocorrências elegíveis | 7.150/7.709 | 7.161/7.709 |
| Comparações originais compostas | 38.963 | 41.411 |
| Rejeições de guards | 3.869 | 3.869 |
| Folhas externas validadas | 43/97 | 43/97 |

## Dois callbacks fechados

- **B9:AB12 — 576 casos aceitos:** reproduz a faixa unsigned de `$24 - $0CBC < $0019`. Na faixa, escreve `$151C` em sprite+$46 e no cursor salvo na pilha por `STA $04,S` em A223. O wrapper restaura esse cursor e continua em A11A. Fora da faixa, preserva o cursor. Cobertura inclui limites, wrap e cursor inicial FFFF; testes nativos usam a autorização gerada e proíbem o adaptador externo.
- **B9:AFE7 — 1.872 casos aceitos:** compara X com `$04F9`; somente o dono inicia o fade lógico. A chamada original `$808024 → $808501` executa `STZ $04ED` antes de `STA $04EC`, preservando a sobreposição das palavras. Depois aplica TSB `$05AF` e grava FFFF em `$195B`. Estado compartilhado ausente é rejeitado sem commit.

A soma nova é 2.448 casos. O oráculo executa os bytes originais dos caminhos e dependências, comparando sprite, WRAM compartilhada, cursor e continuação. Não representa equivalência de CPU completa ou frequência de gameplay. Inicializar o estado lógico de fade não conclui o PPU/renderer.

## Evolução conjunta do Forja65

O pacote enviado tinha um plano em `native-dispatch/` com 61 pendências, anterior ao plano atualizado de 52 em `crossfeed/`. Os três planos publicados desta versão foram regenerados e ficaram idênticos, agora com 50 pendências.

O Forja65 v0.3.59 passou a emitir `proof_pack_fingerprint`, calculado sobre os valores JSON do proof pack completo. O importador DKC3 compara esse vínculo com as provas atuais antes de escrever o header ou copiar o plano. Plano antigo, vínculo ausente ou divergente falham antes de alterar os arquivos. Isso detecta inconsistência de versões; não é autenticação criptográfica do plano. O header de autorização foi gerado pelo importador.

A impressão usa tipos explícitos, números binary64 finitos, UTF-8 e chaves ordenadas por UTF-16; arrays conservam ordem. Os testes fixam o mesmo hash em JS/Python para Unicode, fração, boolean/null e -0.0, verificam mudança de casos, troca de ordem e recusa de valores não finitos. Os proof packs atuais não contêm surrogates isolados nem o token inteiro -0; esses valores não integram o domínio interoperável desta versão.

## Validação

- **53/53 testes nativos aprovados**, Linux/GCC Debug, incluindo testes de integração dos novos callbacks e a nova regressão de vínculo de provas.
- **101/101 testes Forja65 aprovados**, incluindo a nova regressão de fingerprint.
- O teste de equivalência usa a biblioteca construída pelo CMake, com `CXX=missing-g++`, preservando a correção do caminho que antes exigia g++ diretamente no Windows. Esta execução não testa o Windows.
- **455 arquivos de ROM/assets byte a byte idênticos** à base enviada. SHA256 da ROM: `2277a2d8dddb01fe5cb0ae9a0fa225d42b3a11adccaeafa18e3c339b3794a32b`.
- Na validação local, um executável `native_stages` com cabeçalho zerado foi reconstruído; um teste `native_frontend` foi repetido após limpar dados temporários. Os retestes passaram e uma suíte completa nova foi usada como evidência final.
- Revisão independente dos corpos, pilha e vínculo de provas sem defeitos bloqueantes. Sugestões de regressão foram adicionadas antes da entrega.

## BA29 e próximos bloqueios

BA29 continua sem autorização nativa. Os nove traces da v091 são preservados: a rota `$5C=0` ainda exige um contrato mais amplo ou prova de invariante para o retorno pela pilha. Comandos 0, 3 e 4 permanecem condicionais; não se promoveu artificialmente nenhum handler inteiro.

A família A602/A683/A6F2 continua no topo das dependências que afetam o comando 3. A683 tem 102 ocorrências estruturais diretas, mas suas chamadas de inicialização e mudanças de cursor exigem fechamento conjunto. É um alvo de maior impacto para a próxima iteração.

## Integridade dos pacotes

O ZIP Forja65 enviado estava truncado, sem diretório central. Foram recuperadas 199 entradas completas por tamanho/CRC; os arquivos ausentes de código, ferramentas e testes foram reconstruídos somente quando idênticos aos hashes de `CONTENTS.sha256`. Evidências v091 foram restauradas pelos mesmos hashes a partir do DKC3 enviado. O resultado de testes ausente foi substituído pelo novo resultado 101/101. O ZIP entregue foi recriado e verificado por CRC integral, sem alterar a base do motor para uma versão anterior.

Os pacotes incluem fontes, provas, workbench ROM, planos, exemplos cruzados, manifests e logs em `docs/validation/`. A contagem de ocorrências é da gramática estática fechada, sujeita aos guards; não é FPS nem percentual do jogo concluído.

## Reprodução

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j 4
ctest --test-dir build --output-on-failure
DKC3_ANIMATION_ORACLE_LIBRARY="$PWD/build/libdkc3_animation_oracle.so" python tools/animation_handler_equivalence.py
# Em Forja65, regenere usando a ROM, knowledge e proof pack do DKC3 atual:
node tools/forja65.js native-dispatch /caminho/dkc3/rom/dkc3_ptbr.sfc --knowledge /caminho/dkc3/crossfeed/forja65-knowledge.json --site B9A157 --proofs /caminho/dkc3/crossfeed/animation-handler-equivalence.json --out /caminho/dkc3/native-dispatch
# No DKC3:
python tools/forja_crossfeed.py import-native-dispatch native-dispatch/native-dispatch.json
```

No Windows, execute BUILD-WINDOWS.cmd com a toolchain CMake instalada; os testes recebem o oracle do próprio build. Sem atualizar as provas e regenerar o plano correspondente, o novo vínculo deve impedir a importação.
