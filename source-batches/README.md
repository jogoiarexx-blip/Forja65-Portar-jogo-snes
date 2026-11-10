# Fonte REV216 — lote de evidências observadas

Este diretório armazena um lote TAR.GZ de **três arquivos originais** do ZIP completo da REV216, sem ROMs. O workflow de sincronização extrai os arquivos em seus caminhos corretos somente quando não há conflitos.

Arquivos esperados:

- `profiles/super-bomberman-2/observed-cpu-entry-states-rev216.json` — SHA-256 `41e761fe324b821c098a2a74739283aef465835102d92df95a206ba983401f32`
- `reports/rev216/knowledge-union.json` — SHA-256 `c3c64500179d47664084feceebd5985024db42ca23c7778408049a383b224c6c`
- `tests/rev216-observed-cfg-catalog.js` — SHA-256 `352d884162aa9fa839cf5565f6221adc3dc4b78548b22b734f4e6f1e3de516b2`

A rotina aplica a verificação de 746 estados do catálogo de Super Bomberman 2 e tenta publicar os arquivos extraídos no repositório. Se o GitHub negar o push automatizado, o arquivo compactado continuará disponível para extração manual.
