# DKC3 v0.91.0 — nove callbacks adicionais

## Resultado

Nove callbacks originais do comando 3 foram traduzidos e comparados por execução dos bytes da ROM com o C++ nativo. O total passa de **113 para 122 callbacks**, com **38.963 comparações compostas aceitas** e **3.869 rejeições de guards**. Comandos 3/4 continuam condicionais; **22/25 handlers completos**, comando 0 **21/22 destinos**. Não há promoção artificial para 23/25.

| Callback | Semântica verificada | Casos aceitos |
|---|---|---:|
| B9:AFD8 | Metade aritmética de `$30` e impulso do descritor FF | 480 |
| B9:AFDF | Impulso do descritor FF, sem alterar `$30` | 384 |
| B9:B423 | Estado `$6D`, impulso e máscara de flags | 480 |
| B9:B43A | Velocidades orientadas pelo bit `$4000`, temporizador e incremento com wrap | 768 |
| B9:AA3F | Som condicionado a flags e limites relativos à câmera | 560 |
| B9:AFA4 | Som somente quando a palavra `$075C` é exatamente 3 | 980 |
| B9:B1EF | Seleção do som 7/8 pelo bit `$4000` | 2.432 |
| B9:B2D4 | Contador limitado a 7 e som condicionado | 952 |
| B9:B98A | Fila direta do som `$0606`, condicionada a `$05AF` | 544 |

Os nove somam 7.580 casos aceitos. Os testes comparam sprite, memória compartilhada, cursor e continuação. Exercitam sinal, wrap, bit `$4000` independente de `$8000`, descritores junto ao limite do banco, fila cheia/inibida e ponteiros rejeitados. Testes C++ usam o dispatcher autorizado, um adaptador externo proibido e verificam rollback diretamente, inclusive quando B2D4 incrementa o contador antes de uma rejeição na fila.

A revisão encontrou uma correlação nos dados de AA3F que evitava a rota dentro dos limites da câmera. As dimensões foram desacopladas e os PCs aceitos passaram a ser obrigatórios. A implementação não precisou de correção.

## BA29: bloqueio localizado com mais precisão

A única ocorrência estrutural está na animação `$0180`, marcador `F9:47BE`, com entrada do callback em cursor `$47BF`.

- `$5C != 0`, `$5E = 0`: epílogo de encerrar o update.
- `$5C != 0`, `$5E != 0`: epílogo de continuar.
- `$5C = 0`: na fixture de sprite ID zero, a desalocação retorna, B84C limpa `$48` e incrementa `$46`; o `RTS` de `B9:BA42` consome o cursor salvo e resulta em **B9:47C2**, sem consumir o DBR salvo.

O teste executa nove trajetórias originais: o cursor real e dois limites de wrap. Isso não prova que a rota zero é alcançável em gameplay, nem a validade da execução posterior, nem toda a desalocação. Falta provar um invariante que exclua essa rota na animação 0180, ou recuperar um contrato de entrada/retorno mais amplo. BA29 permanece ausente do switch nativo e explicitamente rejeitado no teste do dispatcher.

## Cobertura estrutural

| Métrica | v0.90 | v0.91 |
|---|---:|---:|
| Callbacks originais | 113 | 122 |
| Handlers completos | 22/25 | 22/25 |
| Comando 0 | 21/22 | 21/22 |
| Dependências pendentes | 61 | 52 |
| Ocorrências elegíveis dos comandos 3+4 | 889/1.490 | 932/1.490 |
| União de handlers e rotas condicionais elegíveis | 7.107/7.709 | 7.150/7.709 |
| Folhas externas | 43/97 | 43/97 |

A união usa as ocorrências da gramática fechada, incluindo repetições; não usa a contagem de sites únicos. A autorização combina callbacks legados e subdomínios originais sem duplicá-los. A elegibilidade continua sujeita aos guards de estado/perfil. Não representa frequência de gameplay, FPS ou porcentagem do jogo concluído. PPU/renderer continuam fora do escopo.

## Forja65 e reprodução

Forja65 permanece **v0.3.58**, sem alteração no motor. A integração foi regenerada e o exemplo `examples/dkc3-v091` contém o novo proof pack, plano e resultados. O header C++ foi regenerado pelo importador, não editado para forçar autorização.

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j 4
ctest --test-dir build --output-on-failure
# Linux: use a biblioteca recém-compilada para regenerar as provas.
DKC3_ANIMATION_ORACLE_LIBRARY="$PWD/build/libdkc3_animation_oracle.so" python tools/animation_handler_equivalence.py
node ../Forja65-v0.3.58/tools/forja65.js native-dispatch rom/dkc3_ptbr.sfc --knowledge crossfeed/forja65-knowledge.json --site B9A157 --proofs crossfeed/animation-handler-equivalence.json --namespace dkc3_generated --out generated-dispatch
python tools/forja_crossfeed.py import-native-dispatch generated-dispatch/native-dispatch.json
```

A suíte nativa passou **52/52**, incluindo os replays existentes sem injeção de posição, velocidade, vida ou inventário. A investigação BA29 foi reexecutada após incluir o cursor da ocorrência real. Resultado do Forja65 em `docs/validation/forja-v0358-v091-suite.json`. Compilação Linux/GCC Debug; Windows/MSVC não foi executado nesta rodada.

ROM e todos os 455 arquivos de ROM/assets foram preservados byte a byte. SHA256 da ROM: `2277a2d8dddb01fe5cb0ae9a0fa225d42b3a11adccaeafa18e3c339b3794a32b`.
