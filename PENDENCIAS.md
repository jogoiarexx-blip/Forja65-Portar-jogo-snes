# Pendências — REV216

1. **Fonte completo no GitHub:** já sincronizados 517 arquivos em `tools/`, 849 em `tests/` e 136 em `profiles/`, com hashes verificados. Ainda faltam arquivos de grande porte, entradas geradas dos ports, fixtures e documentos históricos do ZIP organizado. Não publicar ROMs comerciais, dumps binários nem temporários indiscriminadamente.
2. **Cobertura AOT:** testar e certificar a campanha inteira dos ports, inclusive Bomberman 2, além dos replays já registrados. A inexistência de fallback numa rota não demonstra ausência global de fallback.
3. **Fidelidade de hardware:** continuar testes diferenciais de CPU, PPU, DMA, HDMA, WRAM, SPC700, DSP e sincronismo.
4. **Windows:** executar os EXEs em máquina Windows real, verificando vídeo, áudio, entrada, saves e progresso. Compilação PE64 sozinha não prova execução funcional.
5. **Distribuição:** o workflow de GitHub Pages concluiu com sucesso para a sincronização REV216. Falta validar em um navegador real os fluxos de upload de ROM, análise e geração/transferência do port.

As pendências não foram resolvidas pela reorganização de documentação.
