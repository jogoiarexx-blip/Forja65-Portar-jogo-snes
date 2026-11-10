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
