# Forja65 — crossfeed Soldiers v0.34

- Correção em `tools/integrate-observed-flow.py`: `_partN` representa divisão de uma variante da CPU, e não variantes adicionais. O integrador agora exige partes contíguas.
- Preservadas verificações de fingerprint da ROM, conjunto de endereços e observações da execução.
- Adicionado `tools/test_observed_route_v34.py` e provas dos quatro destinos reais tratados pelo Soldiers. Execução desses testes: 3 aprovados; regressões de prova v0.32: 5 aprovadas.
- Novo limite em Soldiers: `$C0:9DA6`, com 154 PCs sobrepostos a rotinas já existentes. A integração foi recusada; veja `pending-C09DA6.json`.
- Nenhuma alteração global em PPU, CPU, SPC700, DMA ou temporizadores do motor Forja65 nesta atualização.
- O gameplay Soldiers segue não comprovado.
