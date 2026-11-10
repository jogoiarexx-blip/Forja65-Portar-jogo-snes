#!/usr/bin/env python3
"""Report generated-code coverage of C0:F923; no inference of branch semantics."""
import argparse, json, re
from pathlib import Path

def inspect(root, target='C0F923'):
    root=Path(root); src=root/'src'; target=target.upper().replace(':','').removeprefix('0X')
    if not re.fullmatch(r'[0-9A-F]{6}',target): raise ValueError('target must be a 24-bit hex address')
    expr=re.compile(r'(?<![0-9a-fA-F])(?:0x)?'+target+r'(?![0-9a-fA-F])',re.I)
    references=[]
    for path in sorted(src.glob('*.cpp')):
        for i,line in enumerate(path.read_text(encoding='utf-8',errors='replace').splitlines(),1):
            if expr.search(line): references.append({'file':str(path.relative_to(root)),'line':i,'excerpt':line.strip()[:180]})
    return {'target':f'{target[:2]}:{target[2:]}','generated_cpp_references':references,
        'explicit_reference_count':len(references),'semantics_proven':False,
        'note':'Absence of a textual target reference is not proof the ROM cannot reach this PC. Indirect jumps and generated dispatch may be represented differently.'}

def main():
    p=argparse.ArgumentParser(); p.add_argument('root');p.add_argument('--target',default='C0F923');p.add_argument('--out');a=p.parse_args()
    result=inspect(a.root,a.target); s=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if a.out: Path(a.out).write_text(s,encoding='utf-8')
    print(s,end='')
if __name__=='__main__': main()
