# Validação — REV216

## Preservação do motor

O arquivo `forja65-core.js` do repositório é idêntico ao do ZIP REV216 organizado.

SHA-256 do motor preservado:
`1da2d934726aee51a2c81f946b1d6ef25f7c09b5b5bcb08f2cf4f497663b0191`

A interface `Forja65-Portable.html` também corresponde byte a byte à versão do ZIP. O novo `index.html` reutiliza o mesmo blob Git, sem modificar o conteúdo da interface.

## Testes registrados no ZIP organizado

- `node --check forja65-core.js` — PASS
- `node tests/rev216-observed-cfg-catalog.js` — PASS, 746 estados
- `node tests/bomberman-timed-state-v043693-regression.js` — PASS
- `node tests/bomberman-cfg-catalog-v043691-regression.js` — PASS
- `python tools/verify-crossfeed-release.py` — PASS
- `node tools/verify-forja-release.js` — PASS

Estes testes referem-se ao **pacote ZIP completo**, não a um teste integral realizado no GitHub Pages. Não certificam gameplay completo nem EXE Windows.

## Testes executados no GitHub — sincronização toolchain

O workflow de importação executou e passou: `node --check tools/forja65.js`, `node --check tools/gui-server.js`, os regressivos `rev216-observed-cfg-catalog`, `bomberman-timed-state-v043693`, `bomberman-cfg-catalog-v043691`, `cfg-global-v043695` e `rev215-dma-refresh-alignment`.

Os 1.501 arquivos transferidos foram conferidos individualmente por SHA-256. Nenhum arquivo pré-existente com conteúdo divergente foi substituído. [Execução do workflow](https://github.com/jogoiarexx-blip/Forja65-Portar-jogo-snes/actions/runs/42864891297).

O GitHub Pages concluiu a implantação do commit importado. Isto comprova a infraestrutura de publicação, mas **não** a execução real da interface no navegador, a jogabilidade completa, a ausência global de interpretação ou a validação do EXE no Windows.
