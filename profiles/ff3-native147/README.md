# REV147 — correções orientadas pela partida do usuário

Os arquivos de entrada ficam em `inputs`. Os logs registram uma partida de 221.998 quadros que o usuário informou ter concluído. Não existe gravação dos comandos dessa partida; portanto ela não é declarada como novamente reproduzida por esta revisão.

O aprendizado aceitou as 107 observações, com 86 combinações PC/E/M/X distintas antes ausentes do despacho. `static-coverage-before.json` registra 86 faltas; `static-coverage.json` registra zero faltas após integração. É cobertura estática, não prova de equivalência de todas essas rotinas em execução. Foram acrescentadas 187 funções C++ e 2.242 entradas, sem substituir os proprietários anteriores.

A tela final da Capcom foi investigada em `ending`. O estado $0429=$0041 seleciona EC38BD, cujos bytes originais são C2 30 6B (REP #$30; RTL). Esse estado não verifica Start. Os quadros/NMI/CPU continuam avançando e as entradas são recebidas. F5 é uma ação explícita do port para reconstruir a sessão, sem modificar a ROM ou as variáveis de campanha.

Ao reiniciar, relatórios são preservados em `restart-audit-N`; depois a sessão antiga fecha áudio/janela, preserva SRAM e libera snapshots de controle. A nova sessão ignora o checkpoint de entrada e começa no reset da ROM. As contagens de observação do interpretador são reiniciadas depois do arquivamento. A ausência legítima de arquivo de áudio em execução headless sem WAV não impede o reinício.

O diagnóstico SPC agora identifica `aot_instruction` quando o hook de instrução está instalado. Scheduler e código SPC não foram alterados.

A validação adicional do navio/Drake encontrou C03718 M0X0 e C0E087 M0X0. `learning-drake` incorpora mais duas funções e 68 entradas, somando 189 funções e 2.310 entradas na revisão. A prova final do trecho de 23.353 registros zerou as 18.643 instruções CPU interpretadas da REV146, com imagem/WRAM/PC, PCM e WRAM final idênticos. O relatório estático adicional cobre dois estados; somados aos 86 do usuário, são 88 estados observados.
