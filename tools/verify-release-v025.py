#!/usr/bin/env python3
"""Verify the complete release manifest on Windows or Linux. Exit 0 iff intact."""
from pathlib import Path
import hashlib
import sys

root=Path(__file__).resolve().parents[1]
failed=[]
manifest=root/'MANIFEST.sha256'
count=0
for row in manifest.read_text(encoding='utf8').splitlines():
    digest,name=row.split('  ',1)
    path=root/name
    if not path.is_file():
        failed.append({'path':name,'reason':'missing'})
    elif hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
        failed.append({'path':name,'reason':'sha256 mismatch'})
    count+=1
for n in ('VERSION','VERSION.txt'):
    if (root/n).read_text().strip()!='0.4.27-unified-wram-video':
        failed.append({'path':n,'reason':'wrong release version'})
if failed:
    for item in failed:print(item)
    sys.exit(1)
print(f'RELEASE_SHA256_PASS files={count}')
