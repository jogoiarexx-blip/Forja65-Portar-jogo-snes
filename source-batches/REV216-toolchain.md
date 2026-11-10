# REV216 — lotes de ferramentas, testes e perfis

Foram enviados 12 arquivos `rev216-toolchain-001..012.tar.gz` para importar **1.501 arquivos** do ZIP fonte organizado, preservando todos os nomes relativos e o conteúdo original.

O processo automatizado verifica o SHA-256 individual em cada lote, recusa diretórios fora do escopo, symlinks, caminhos relativos inseguros, arquivos maiores que 1 MB, arquivos duplicados e quaisquer substituições de arquivos existentes com conteúdo diferente.

**O workflow é a etapa que descompacta e efetivamente adiciona os arquivos à branch `main`.** O commit dos lotes por si só não prova que a importação terminou; é preciso consultar o resultado de [GitHub Actions](https://github.com/jogoiarexx-blip/Forja65-Portar-jogo-snes/actions/workflows/rev216-import-toolchain.yml).

Exclusões nesta rodada:
- ROMs comerciais, arquivos `.sfc` e blobs `.bin`;
- o arquivo de referência SPC700 `.zip` de 16 MB e fixtures `.gz` grandes;
- saídas geradas gigantes (>60 kB em perfis, >100 kB em testes);
- registros históricos volumosos de `docs/`, `reports/`, `crossfeed-historico/`, `merge-evidence/`.

O relatório `reports/bomberman-catalog-provenance-v043691.json` está incluído porque um teste de regressão depende dele.

**Importante:** o pacote completo de fontes REV216 permanece mais abrangente do que esta publicação parcial. A importação não altera `forja65-core.js`, `Forja65-Portable.html`, `index.html` ou o código do runtime já publicado.
