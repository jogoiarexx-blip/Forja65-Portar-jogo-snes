#!/usr/bin/env python3
"""Self-consistent, acyclic SHA256 manifest check for the 5-branch crossfeed.

Hierarchical manifests exclude their own digest to avoid circular hashes:
CONTENTS.txt (ordinary files), CONTENTS.sha256 (+ CONTENTS.txt),
MANIFEST.sha256 (+ CONTENTS.sha256), SHA256SUMS.txt (+ MANIFEST.sha256).
"""
from pathlib import Path
import hashlib
import sys
root=Path(__file__).resolve().parents[1]
indexes=('CONTENTS.txt','CONTENTS.sha256','MANIFEST.sha256','SHA256SUMS.txt')
def filelist():return sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
def sha(name):return hashlib.sha256((root/name).read_bytes()).hexdigest()
def lines(digest_file):
    result={}
    for line in (root/digest_file).read_text(encoding='utf8').splitlines():
        h, sep, name=line.partition('  ')
        if not sep or name in result or len(h)!=64:raise ValueError('Invalid manifest row: '+line[:100])
        result[name]=h
    return result
def verify():
    paths=set(filelist())
    if not set(indexes)<=paths:raise ValueError('Required manifest missing')
    ordinary=paths-set(indexes)
    declared_contents=(root/'CONTENTS.txt').read_text(encoding='utf8').splitlines()
    if declared_contents!=sorted(ordinary):raise ValueError('CONTENTS.txt stale')
    for filename,expected in [('CONTENTS.sha256',ordinary|{'CONTENTS.txt'}),('MANIFEST.sha256',ordinary|{'CONTENTS.txt','CONTENTS.sha256'}),('SHA256SUMS.txt',ordinary|{'CONTENTS.txt','CONTENTS.sha256','MANIFEST.sha256'})]:
        record=lines(filename)
        if set(record)!=expected:raise ValueError('Incomplete manifest: '+filename)
        for name,h in record.items():
            if sha(name)!=h:raise ValueError('Hash mismatch: '+name+' in '+filename)
    print('CROSSFEED_RELEASE_INTEGRITY_PASS files='+str(len(paths)))
if __name__=='__main__':
    try:verify()
    except (ValueError, OSError) as exc:
        print('CROSSFEED_RELEASE_INTEGRITY_FAIL',exc,file=sys.stderr);sys.exit(1)
