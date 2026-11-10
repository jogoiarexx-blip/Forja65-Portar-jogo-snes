# Final Fight 3 — perfil REV146

O fonte do jogo entregue ja contem esta integracao. Nao aplique novamente a tag native146union. Para novas observacoes, use uma tag nova com tools/learn-from-interpreter.js, --rom apontando a assets/cart-data.bin, --log ao log CPU e --core merge-evidence/rev144/cpu-resume143-core.js. O importador registra o hash do emissor e preserva donos antigos do despacho.

Para regenerar SPC no fonte do jogo: `node build-spc-aot.js /caminho/work144/forja65-core.js`. A analise deve encontrar 1855 PCs do driver e 2 tabelas; os 64 casos IPL sao separados. Consulte PROGRESSO-REV146.md para provas e limites.
