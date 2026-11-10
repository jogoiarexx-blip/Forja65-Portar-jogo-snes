# Forja65 — REV216

Ferramenta experimental de análise e recompilação de jogos Super Nintendo.

**Abrir na Web:** https://jogoiarexx-blip.github.io/Forja65-Portar-jogo-snes/

## Situação do repositório

Esta publicação contém a interface `Forja65-Portable.html`, o gerador `forja65-core.js` (preservados byte a byte da REV216), fontes nativas e exemplos selecionados. **Não é ainda o espelho completo do pacote de fonte REV216 organizado**, que contém testes, perfis, ferramentas e evidências adicionais.

Na REV216, o catálogo observado do Super Bomberman 2 passou de 620 para 746 estados de entrada. Isso não significa que a campanha inteira tenha sido jogada ou recompilada sem uso do runtime do SNES.

## Como usar

- **Navegador:** abra o endereço acima (a página inicial reutiliza exatamente o código de `Forja65-Portable.html`).
- **Windows/fonte completo:** use o ZIP REV216 organizado, que inclui `ABRIR-FORJA65.cmd`, `tools/`, `tests/`, `profiles/` e os relatórios.
- **ROMs:** use apenas dumps obtidos legitimamente. Nenhuma ROM comercial é fornecida aqui.

## Testes automáticos da REV216

O repositório mantém um teste de estados temporizados do Bomberman 2, um teste C++ de alinhamento DMA/WRAM (192 vetores) e uma verificação de igualdade entre o catálogo incorporado no motor e `profiles/super-bomberman-2/cfg-knowledge.json`. Veja [a rotina de smoke tests](.github/workflows/forja216-smoke.yml).

Os registros de 746 estados observados também são distribuídos em [lote de origem](source-batches/README.md) para sincronização controlada, sem incluir ROMs. O restante dos milhares de arquivos do ZIP completo ainda não está integralmente no GitHub.

## Documentos

- [Histórico consolidado](CHANGELOG.md)
- [Versões do pacote e do motor](VERSOES.md)
- [Validação e limites](VALIDACAO.md)
- [Pendências](PENDENCIAS.md)
- [Situação da publicação](PUBLICACAO-REV216.md)
- [Auditoria Bomberman 2 v0.60](reports/rev216/Bomberman-v0.60-AUDITORIA.md)

Esta etapa de publicação não altera o gerador, o runtime nem a compatibilidade dos ports.

## Atualização de publicação — 10/11/2026

A sincronização de 12 lotes autenticados por SHA-256 importou os arquivos técnicos da REV216 para a branch `main`. O GitHub agora contém **517 arquivos em `tools/`, 849 em `tests/` e 136 em `profiles/`**, além dos exemplos, fontes nativas e relatórios já publicados. Os 1.501 arquivos dos lotes foram conferidos; quatro já existiam com conteúdo idêntico.

O processo passou nos cinco testes automáticos e na verificação de hashes do [workflow de importação](.github/workflows/rev216-import-toolchain.yml). Os arquivos utilizados podem ser consultados nos [lotes de origem](source-batches/REV216-toolchain.md).

**Ainda é uma publicação parcial do ZIP completo.** Permanecem excluídos arquivos grandes gerados, referências binárias de jogos, fixtures volumosas e históricos de auditoria. Nenhum resultado adicional de gameplay completo ou execução de EXE Windows foi certificado.
