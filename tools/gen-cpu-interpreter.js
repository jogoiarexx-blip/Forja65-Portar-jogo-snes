#!/usr/bin/env node
'use strict';
// Forja65 REV133 — gera o interpretador 65C816 de fallback a partir do PROPRIO emissor do Forja.
//
// Cada opcode x estado (E=1, ou E=0 com M/X = 00,01,10,11) e emitido por generateVariantBody,
// exatamente como no codigo AOT. Os literais do operando e do PC sao trocados por variaveis de
// execucao (ipc/opL/opW/opB). Assim o interpretador tem a MESMA semantica, temporizacao, acessos
// ao barramento e protocolo de pilha/retorno nativo do codigo recompilado (validado no SST 65816).
//
// O interpretador so roda quando o dispatcher nao encontra rotina recompilada para o PC/estado
// pedido. Assim que o PC volta a ter variante AOT, a execucao retorna ao codigo nativo.
//
// Uso: node tools/gen-cpu-interpreter.js <saida.cpp> [--core forja65-core.js]
const fs=require('fs'),path=require('path');
function arg(name,def){const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:def;}
const out=process.argv[2];
if(!out){console.error('uso: node tools/gen-cpu-interpreter.js <saida.cpp> [--core forja65-core.js]');process.exit(2);}
const corePath=path.resolve(arg('--core',path.join(__dirname,'..','forja65-core.js')));
const F=require(corePath);

const src=F.buildCpuInterpreterSource?F.buildCpuInterpreterSource():(()=>{throw new Error('core sem buildCpuInterpreterSource (precisa REV133+)');})();
fs.writeFileSync(out,src);
console.log(`interpretador gerado: ${out} (1280 variantes, ${(src.length/1024).toFixed(0)} KB)`);
