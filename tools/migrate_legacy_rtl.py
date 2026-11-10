#!/usr/bin/env python3
"""Repara RTL antigo que ignorava retornos PHK/PEA construidos (sem criar bypass inseguro).

Somente adiciona o mesmo consumeConstructedLongReturn que o gerador moderno usa.
Esse predicado exige bytes de ROM, pilha, frame nativo e destino correspondentes.
"""
import argparse
from pathlib import Path
import re

PATTERN=re.compile(r'if\(!hw\.nativeReturnMatches\(dst,true,cpu\)\)\{\s*'
    r'(?!if\(hw\.consumeConstructedLongReturn\(dst,cpu\)\))'
    r'if\(forja65_is_stack_return_target\(dst,hw\)\)\{'
    r'hw\.retireRedirectedNativeReturn\(cpu,true\);'
    r'(?P<pop>cpu\.(?:pop16Value\(hw\);cpu\.pop8Value\(hw\);|popLongReturn\(hw\);|dropStack\(3u,true\);))'
    r'cpu\.pb=bank;hw\.requestDispatch\(dst,(?P<pc>0x[0-9a-fA-F]+u)\);return;\}')

def migrate(source):
    def change(m):
        pop,pc=m.group('pop','pc')
        return ('if(!hw.nativeReturnMatches(dst,true,cpu)){ '
                'if(hw.consumeConstructedLongReturn(dst,cpu)){' + pop + 'cpu.pb=bank;hw.requestDispatch(dst,'+pc+');return;} '
                'if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);'+pop+
                'cpu.pb=bank;hw.requestDispatch(dst,'+pc+');return;}')
    return PATTERN.subn(change,source)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('paths',nargs='+',type=Path)
    p.add_argument('--apply',action='store_true',help='altera os fontes (padrao: auditoria somente)')
    a=p.parse_args()
    total=0
    for file in a.paths:
        if not file.is_file():
            p.error(f'arquivo nao encontrado: {file}')
        src=file.read_text(encoding='utf-8')
        updated,count=migrate(src)
        total+=count
        print(f'{file}: {count} RTL(s) legado(s) identificados')
        if a.apply and count:
            file.write_text(updated,encoding='utf-8')
    print(f'TOTAL {total} — '+('corrigidos' if a.apply else 'somente auditoria'))

if __name__=='__main__':main()
