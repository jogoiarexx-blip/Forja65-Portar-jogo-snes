# Final Fight 3 — sementes observadas da campanha

ROM SHA-256 f9dac709b2c2859f828103a0dd980716817e2bde3b9d7e2fdea36e9bb9bed7f2, fingerprint 0219ea8f95a4f0ed.

Estes perfis foram observados em execução; não são prova de CFG estático completo. A campanha REV143/Linux recebeu quatro integrações com o emissor preservado cpu-resume143-core.js e o importador corrigido. Foram emitidas 978 funções C++ em 11 unidades, com 10.964 entradas de despacho novas; isso não significa que todas as funções foram exercitadas.

A repetição final isolou CPU com SPC de referência: zero fallback CPU em 5.000 frames iniciais e em 3.311 registros do trecho da sexta fase, com hashes de imagem/WRAM/PC e áudio iguais às referências. O checkpoint carrega contadores históricos: use a diferença de contador para o trecho restaurado. Consulte release145-summary.json e stage6-comparison145.json.

O gerador atual exige APIs de timing ausentes no runtime antigo da campanha. Não integre código moderno nessa pasta sem uma migração de runtime testada; o port entregue foi gerado com o emissor correspondente à sua ABI. Não há nova certificação de Windows, FPS, SPC AOT ou campanha completa.
