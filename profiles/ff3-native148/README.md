# FF3 desktop REV148 — adaptador explícito

Este perfil acrescenta a interface desktop do Final Fight 3 ao projeto nativo REV147 exato. Conserva o perfil `ff3-native147`, suas rotas aprendidas, o restart F5 e o SPC AOT. Não muda a geração genérica do Forja nem os perfis de outros jogos.

## Aplicação

Feche o jogo e trabalhe numa cópia do projeto fonte REV147 original. Node.js 18 ou posterior basta para aplicar; não precisa de npm.

```sh
node tools/upgrade-desktop148.js --check /caminho/Final-Fight-3-REV147
node tools/upgrade-desktop148.js /caminho/Final-Fight-3-REV147
```

A pasta informada deve conter `src` e `assets/cart-data.bin`. O adaptador compara SHA-256 de todos os `.cpp`/`.hpp` de `src`, exige a lista exata e confere a ROM SHA-256 `f9dac709b2c2859f828103a0dd980716817e2bde3b9d7e2fdea36e9bb9bed7f2`. A identidade usada pelo runtime é `0219ea8f95a4f0ed` (algoritmo FNV com offset histórico do Forja, diferente do offset padrão).

`--check` valida e lista os seis arquivos sem gravar nada. Uma versão desconhecida, fonte editado, revisão misturada, ROM diferente ou symlink de entrada é recusado antes de criar qualquer arquivo. Um projeto já convertido retorna `already-upgraded` sem gravar. Os arquivos ocultos temporários históricos e os artefatos `.gch` não contam como fontes e não são substituídos.

A atualização copia integralmente seis fontes verificados em `desktop-src`; não tenta substituições por regex. Antes da troca cria `forja-desktop148-backup-*` com os três arquivos anteriores e `restore.json`, que identifica também os três novos arquivos. Uma exceção durante a troca restaura os arquivos já trocados e remove os novos. A pasta de backup permanece para auditoria. A trava `.forja-desktop148-lock` impede dois adaptadores concorrentes. Fechamento abrupto do processo ou falha de energia exige restauração manual: copie de volta os arquivos marcados `existed: true`, remova os marcados `false`, retire a trava e confira novamente com `--check`. Não há garantia de transação atômica contra queda de energia.

Após aplicar, reconstrua com os scripts originais do projeto (`python3 build-linux.py` ou o script Windows fornecido). Remova qualquer PCH antigo `src/runtime.hpp.gch` antes da compilação e use uma pasta de build limpa. O adaptador não remove artefatos de compilação existentes. O adaptador não entrega um novo executável, não altera scripts de build e não compila automaticamente.

## Recursos incorporados

| Comando | Efeito |
|---|---|
| Esc | Menu pausado; continuar, salvar/carregar, opções, reiniciar e sair |
| F6 / F9 | Salvar / carregar o slot rápido selecionado (1–5) |
| F11 | Alternar tela cheia |
| F5 | Reiniciar a sessão, preservando auditoria e SRAM como na REV147 |
| Menu Áudio | Volume 0–100% e silenciar |
| Menu Filtro | Pixels nítidos, suave (GDI) ou scanlines |
| Menu Janela | Ajustar ou 1x–6x, proporção preservada |

Preferências ficam em `forja65-settings.ini`; estados em `states/ff3-slot-N.f65s`. O formato de estado V3 inclui os três relógios APU adicionais. A carga de estado do usuário rejeita V2; o caminho CLI histórico conserva compatibilidade V2 para os replays existentes. O controlador desktop é Win32; funções puras e o armazenamento podem ser usados no Linux, mas isso não constitui uma interface gráfica Linux.

## Reutilização e limites

`forja_desktop.hpp` oferece `Settings`, `Desktop`, `Request` e `Action`; `forja_startup.hpp` e `forja_user_states.hpp` explicitam a integração com o port. São referências concretas para futuros adaptadores. `main.cpp`, `runtime.hpp` e `forja_checkpoint.hpp` nesta pasta são as versões reconhecidas do FF3, não templates universais. Outro jogo precisa de adaptação de seus pontos de frame, áudio, ROM, checkpoint e ciclo de vida, além de testes próprios. Regenerar o projeto pelo core atual não reaplica automaticamente esta interface; não sobrescreva o projeto convertido com uma geração genérica.

## Testes reproduzíveis

```sh
node tests/desktop-adapter-rev148.js
node tools/test-desktop-upgrade-rev148.js /caminho/Final-Fight-3-REV147-FONTE.zip /caminho/Final-Fight-3-REV148
```

O segundo comando extrai somente fontes e ROM em diretório temporário (Python 3 requerido), aplica o adaptador, confere todos os hashes finais e opcionalmente compara todos os fontes com a revisão 148 indicada. Também verifica preview, idempotência, backup, recusa de alterações/ROM errada/fontes extras/revisão mista/symlink sem gravar e rollback por falha injetada com nova tentativa. Não executa compilação, interface Windows nem uma campanha do jogo.
