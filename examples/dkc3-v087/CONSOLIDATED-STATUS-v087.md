# DKC3 v0.87.0 + Forja65 v0.3.55 — consolidação validada

As bases DKC3 v0.82/v0.86 e Forja65 v0.3.51/v0.3.54 foram combinadas usando os ancestrais v0.78/v0.3.47. O resultado recupera as provas e implementações anteriores e preserva o boot/campanha das bases recentes.

| Evidência | Resultado |
| --- | --- |
| Handlers completos, ABI equivalente | 21/25 |
| Callbacks originais com subdomínios e guardas | 102 |
| Corpos de callback na ABI anterior | 35 equivalentes + 2 boundaries |
| Folhas externas equivalentes | 39/97; 162/368 hits |
| Comando 3, hits elegíveis | 433/828 |
| Comando 4, hits elegíveis incluindo folhas externas | 373/662 |
| Comandos 3+4, união sem dupla contagem | 806/1490 (54,1%) |
| Todos os comandos, hits elegíveis com guardas | 6985/7709 (90,6%) |
| Casos de handlers completos contra o original | 23184 |
| Casos compostos de callbacks originais | 21833 + 263 rejeições de guarda |
| Perfil sonoro original | 22784 casos |
| Testes DKC3 | 49/49 |
| Testes Forja65 | 96/96 |
| ROM, assets e referências preservados | 455 arquivos idênticos à v0.86 |

Os hits representam elegibilidade na gramática estática dos scripts, sujeita aos contratos e guardas reais. Não representam frequência de gameplay, FPS ou fidelidade do jogo inteiro. A contagem de 102 callbacks originais e a de 35 corpos de callback pertencem a modelos de prova distintos e não devem ser somadas.

## Mudanças verificadas

- Retorno de callback rejeitado agora preserva cursor, sprite e estado compartilhado: execução em cópia, commit somente após sucesso.
- O validador Forja65 combina fingerprints de dados ROM, targets indiretos, dependências e pós-condições. A revisão independente encontrou uma especialização capaz de enfraquecer pós-condições; isso foi corrigido e coberto por regressões.
- O oráculo nativo é compilado pelo CMake. Os testes Python usam a biblioteca pronta e não chamam g++ por conta própria, corrigindo a causa do WinError 2 relatado. Exportação dos símbolos no Windows habilitada no target CMake.
- Fila genérica de dependências por impacto, com deduplicação por folha. A fila apenas orienta análise, sem autorizar execução nativa.
- Preservados boot/save/map/campanha da v0.86, incluindo fluxo até Lakeside, Doorstop e Tidal. Não foi acrescentada integração de gameplay de animação nem implementação de PPU.

## Pendências concretas

Continuam quatro handlers parciais: comandos 0, 3, 4 e 6 (8 é alias). Não foram fechados os 25. As rotas fora dos domínios comprovados continuam em fallback.

A análise do maior alvo B6:F9EF confirmou que B9:A000 processa outro fluxo de bytecode de animação, incluindo callbacks dinâmicos. Apenas trocar o ID/resetar campos seria incorreto. A próxima dependência comum é B9:A000, com 80 hits em quatro folhas auditadas; B5:8006 aparece em 42 hits. Essas quatro folhas ainda não são equivalentes e não entram na contagem das 39 comprovadas.

$19DA / SNOW permanece Unknown. $B7:CD1F / PIER conserva sua evidência limitada anterior de 12120 consultas; essa prova não equivale a fechamento de todo o caminho.

## Ambiente e evidências

Validação Linux/GCC Debug. A suíte DKC3 foi executada com CXX=missing-g++ para provar que o oráculo Python usa o artefato CMake pronto. O resultado final reúne a suíte de 49 testes e uma repetição dirigida de oito testes após atualização de expectativas antigas e rebuild final. Uma falha ambiental de permissão no executável rope foi corrigida. Windows/MSVC não foi executado neste ambiente; o ajuste de exportação e a seleção da biblioteca pré-compilada estão no código e nas regressões.

A ROM fornecida não foi alterada. SHA256: 2277a2d8dddb01fe5cb0ae9a0fa225d42b3a11adccaeafa18e3c339b3794a32b.

Os arquivos docs/validation incluem resultados consolidados, XML das execuções, preservação de assets e logs do oráculo. O plano e o relatório do workbench registram a decisão de manter as dependências sem prova em fallback.
