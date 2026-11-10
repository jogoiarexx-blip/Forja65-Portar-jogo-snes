# DKC3 v0.93.0 + Forja65 v0.3.60

Continuação da v0.92.0/v0.3.59, preservando as provas e callbacks anteriores.

| Métrica | Base | Entrega |
|---|---:|---:|
| Destinos originais validados sob guards | 124 | 126 |
| Dependências ainda sem prova | 50 | 48 |
| Handlers completos | 22/25 | 22/25 |
| Comando 0: destinos validados | 21/22 | 21/22 |
| Comando 3: destinos originais autorizados | 65 | 67 |
| Comando 3: ocorrências elegíveis sob guards | 490/828 | 602/828 |
| Comandos 3+4: união elegível sob guards | 943/1.490 | 1.055/1.490 |
| Todos os comandos: união elegível sob guards | 7.161/7.709 | 7.273/7.709 |
| Comparações originais compostas | 41.411 | 44.547 |
| Rejeições de guards verificadas | 3.869 | 3.881 |

## Inicialização e tails dos Kongs

**B9:A683 e B9:A6F2** agora executam o domínio de Kong normal sem carga (`$7E=0`, `$186B=0`). A683 preserva o seletor de velocidade, scratch `$1A`, valor absoluto com wrap e limiar `$20`; A6F2 inicializa a animação. O caminho inclui A0AC/A0BA, reset dos campos, flags e cursores do diretório F9, prefixos 5/12 e primeiro frame. Os tails A65D/A6A0/A6C7 escolhem as transições de andar, escalar e virar, com o Y residual original usado no retorno do comando 3.

As três tabelas de seis palavras vêm da ROM revisada; o perfil decodifica apenas seus 36 bytes, exige a identidade da ROM inteira e rejeita índice/tabela inválidos. Não se acrescentou execução de CPU ao runtime.

A campanha composta executa **3.136 casos originais**, combinando dois sprites, dois handles, flags, sete velocidades horizontais/verticais, orientação e wrap do cursor. Compara sprite, WRAM compartilhada, Y e continuação. Doze rejeições verificam ausência de mutação para animal, carga, handle fora do espelho, prefixo desconhecido, tail desconhecido e loop. O runtime oficial também é testado com adaptador externo proibido, incluindo perfil ausente e os retornos por handle.

A683 tem 94 ocorrências no comando 3; A6F2 tem 18. São **112 ocorrências adicionais elegíveis**. Ocorrências são da gramática estática fechada, sujeitas ao estado e aos guards; não medem frequência de gameplay ou percentual do jogo concluído. Os dois destinos continuam parciais fora desse domínio. As 48 pendências contam destinos sem prova, não os caminhos excluídos desses dois destinos.

## Forja65 e propagação de guards

O Forja65 aceita destinos indiretos inlined somente em provas de dependência com fingerprints dos spans, execução original dos sites/destinos, cobertura por caso e rejeições atômicas dos guards. Esses destinos não exigem provas independentes artificiais de cada tail local.

`required_runtime_guards` mantém o domínio restrito nos chamadores. Um handler inteiro não se torna equivalente por depender de uma prova guardada, mesmo que declare os mesmos guards. A autorização ocorre apenas na especialização do wrapper cujo requisito cobre o domínio do callback, com rejeição concreta no C++. A restrição também atravessa dependências intermediárias: provas de boundary não escondem pré-requisitos, e uma especialização que exige equivalência não aceita apenas um boundary.

A revisão independente encontrou esses dois problemas na propagação. Ambos foram reproduzidos como regressões antes da correção e passaram depois dela. A revisão final não encontrou bloqueadores dentro do escopo analisado. O vínculo do plano ao proof pack da v0.3.59 permanece ativo; os três planos atuais são idênticos e o header foi gerado pelo importador.

## Validação e limites

- **54/54 testes nativos aprovados**, Linux/GCC Debug. A primeira execução teve 53 aprovados e um executável sem permissão de execução (`native_skiddas_row`); após restaurar a permissão, o teste executou e passou. Logs inicial, reteste e XML consolidado estão incluídos.
- **102/102 testes Forja65 aprovados** com o código final, incluindo as regressões de guards, boundary transitivo e downgrade de especialização.
- CTest usa a biblioteca do próprio CMake com `CXX=missing-g++`; preserva a correção de portabilidade do oráculo. Windows/MSVC não foi executado nesta entrega.
- **455 arquivos de ROM/assets idênticos byte a byte** à v0.92.0. SHA256 da ROM: `2277a2d8dddb01fe5cb0ae9a0fa225d42b3a11adccaeafa18e3c339b3794a32b`.

BA29 continua bloqueado pelo contrato de retorno pela pilha. Animal/carregamento/riding, A602 e suas dependências de áudio continuam pendentes. Os comandos 0, 3 e 4 permanecem condicionais; não foram concluídos os 25 handlers, gameplay completo ou PPU.

## Reprodução

Use `cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug`, `cmake --build build`, e `ctest --test-dir build --output-on-failure`. No Windows, use BUILD-WINDOWS.cmd com CMake e toolchain instalados. O teste novo é `animation_kong_idle_equivalence`.

Para regenerar, forneça `DKC3_ANIMATION_ORACLE_LIBRARY` à ferramenta `tools/animation_handler_equivalence.py`; gere o plano com o CLI Forja65 `native-dispatch`, knowledge e provas deste pacote; importe com `tools/forja_crossfeed.py import-native-dispatch`. Os exemplos cruzados e evidências estão em `examples/dkc3-v093` e `docs/validation/v093`.
