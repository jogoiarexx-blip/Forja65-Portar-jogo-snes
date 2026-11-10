# DKC3 v0.89.0 + Forja65 v0.3.57 — handler 6 fechado

O comando 6 ($B9:A232), incluindo o alias 8, passou de parcial para equivalente no ABI revisado. Foram traduzidos e comparados os cinco destinos do seu domínio original, e a composição termina pelo comando 7. São agora **22/25 handlers completos**; os comandos **0, 3 e 4 continuam parciais**. PPU completo permanece pendente.

| Medida | v0.88 | v0.89 |
| --- | ---: | ---: |
| Handlers completos | 21/25 | 22/25 |
| Callbacks originais sob guardas | 102 | 109 |
| Comando 0: destinos originais admitidos | 14/22 | 17/22 |
| Comando 6: destinos originais comprovados | 1/5 | 5/5 |
| Comando 3: destinos originais admitidos | 52/111 | 54/111 |
| Hits de handlers completos | 5843/7709 | 5856/7709 |
| União elegível dos comandos 3+4 | 886/1490 | 889/1490 |
| Todos os hits elegíveis sob guardas | 7065/7709 | 7101/7709 |

Hits são ocorrências na gramática estática fechada, elegíveis somente com o ABI, perfis e ponteiros exigidos. Não representam FPS, frequência de gameplay nem fidelidade do jogo inteiro. Os 35 callbacks do ABI antigo e os 109 corpos originais são modelos de prova sobrepostos, não quantidades que se somam. As folhas externas continuam 43/97, com 242/368 hits.

## Traduções e contratos

- $B9:AB3F: impulso de salto através do helper original B8:8093/906D/9071; seleção de estado segundo o sprite carregado e o Kong ativo.
- $B9:ABE6: ajuste horizontal AC50, escrita do descritor no sprite referenciado por $72, salto e atualização de $1955. O caminho do animal $023C usa o offset $0310 e tem casos aceitos, além de casos rejeitados.
- $B9:ABF7: ajuste horizontal AC50, impulso $FE00, estado7 e $1955=$0010. Preservados o ROR aritmético, overflow e a subtração original.
- $B9:B3BE: velocidade lida pelo ponteiro longo $6A, sinal conforme orientação, reset de $30 e incremento com wrap de $5A.
- $B9:A9CB, A9F5 e B879: três predicates/epílogos do comando0, incluindo a continuação de fim de update. A9F5 compara o estado do sprite referenciado com $49/$4F; ambos os retornos foram executados na ROM.

O perfil de descritores guarda somente o banco FF, é imutável após carregar e exige o fingerprint da ROM completa revisada. A soma ponteiro+Y é de 24 bits. Somente palavras iniciadas em $FF0000..$FFFFFE são aceitas; outros bancos, word cruzando o fim, perfil ausente/inválido e ponteiros WRAM fora da janela admitida permanecem em fallback. Nenhuma tabela de descritores foi inventada/copiada como constantes C++.

No comando6, a escrita indireta do comando7 ainda ocorre com DBR B9. Seu endereço deve ser um espelho WRAM abaixo de $2000 e fora do scratch $42..$45/$70..$71. O oráculo detectou a fronteira $1FFF/$2000; a guarda nativa rejeita sem deixar alterações anteriores do callback. A execução nativa dos comandos6/8 escolhe o callback original comprovado e não chama um adapter externo fornecido pelo chamador.

“Completo” aqui significa fechamento dos cinco destinos no domínio estático e equivalência do ABI documentado, com rejeições explícitas. Não significa que ponteiros arbitrários, todos os bancos ROM ou o controlador inteiro dos Kongs estejam implementados. O interpretador limitado de bytes originais é ferramenta Python de desenvolvimento; o runtime continua C++ direto.

## Forja65 v0.3.57

A nova fila genérica `handler_dependency_priority` mostra os pré-requisitos que bloqueiam handlers inteiros. Ela usa a verificação de cada aresta: status, postcondições e domínio de entrada. Uma dependência equivalente ainda aparece se não satisfaz o requisito do chamador. Caminhos compartilhados/cíclicos contam cada handler uma vez por dependência.

`affected_handler_hits` é o potencial estrutural dos handlers afetados, não o número de chamadas diretas ao callback. A fila serve à priorização e não concede autorização nativa. O exemplo `examples/dkc3-v089` contém as provas, o plano com 22 handlers e 65 bloqueios atuais, e as métricas consolidadas. A revisão encontrou uma omissão inicial de requisitos de aresta; foram acrescentadas regressões red/green de postcondições, entradas e agregação de hits, e a revisão final não encontrou pendências importantes.

## Validação desta entrega

- DKC3: suíte final completa **51/51** em Linux/GCC Debug, após corrigir expectativas antigas de contagem. O log/XML final está em docs/validation.
- Forja65: **99/99** testes.
- **25376 casos dos 22 handlers completos**, mais os oráculos anteriores de callbacks/folhas/dependências.
- **29265 comparações compostas de callbacks originais**, incluindo 2192 casos do handler6. Casos rejeitados são registrados separadamente e verificam preservação de estado.
- Teste nativo através da API autorizada: todos os cinco destinos nos comandos6 e8; retorno e cursor; perfil ausente; rollback; fingerprint alterado.
- Provas exigem cobertura de branches originais aceitos, inclusive $023C, AC50 e os dois epílogos A9F5. Casos que apenas rejeitam pela guarda não satisfazem esses requisitos.
- **455 arquivos presentes em rom/assets idênticos à v0.88**, que já incorporava a campanha Skidda v0.87. ROM SHA256:2277a2d8dddb01fe5cb0ae9a0fa225d42b3a11adccaeafa18e3c339b3794a32b.
- Oráculos Python executados com CXX=missing-g++ e biblioteca CMake pré-compilada. Mantida a correção do WinError2. Windows/MSVC não executado neste ambiente.

Preservada a campanha Publisher → Studio → Title → New Save → Northern → Lake → Lakeside → Doorstop → Tidal → Skidda → Murky bloqueada, com conclusão de Skidda por Dixie/Kiddy. A fidelidade das fases, $19DA/SNOW e PPU continua parcial; esta entrega não promove esses sistemas.

## Próximo fechamento

Comando0 tem cinco destinos ainda pendentes: B9:B08A, B3D2, B662, B68B e BA29. Os dois callbacks B662/B68B compartilham RNG, mudança de cursor na pilha e cálculo de gráfico; B08A/B3D2 chamam rotinas externas; BA29 passa pela desalocação. Isso dá um alvo concreto para chegar a 23/25 antes de ampliar as dependências restantes dos comandos3/4.
