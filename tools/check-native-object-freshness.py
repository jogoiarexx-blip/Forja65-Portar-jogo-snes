#!/usr/bin/env python3
"""Fail closed when manually linking a native port with stale C++ objects.

Complements (does not replace) the compilation-ABI guard. Uses source/object
mtime and existence as a conservative check; a newer object is not by itself
a cryptographic proof it was compiled from the current source or same flags.
Prefer the project build system over manual linking whenever possible.
"""
import argparse
import json
import sys
from pathlib import Path


def check_pairs(pairs):
    if not pairs:
        raise ValueError('At least one source/object pair is required')
    findings=[]
    failures=[]
    for source, obj in pairs:
        source=Path(source);obj=Path(obj)
        if not source.is_file():
            failures.append('missing source: '+str(source))
            continue
        if not obj.is_file():
            failures.append('missing object: '+str(obj))
            continue
        ss=source.stat();os=obj.stat()
        # Precision varies among filesystems; strict comparison fails closed.
        stale=os.st_mtime_ns < ss.st_mtime_ns
        findings.append({'source':str(source),'object':str(obj),'stale':stale,
                         'source_mtime_ns':ss.st_mtime_ns,'object_mtime_ns':os.st_mtime_ns})
        if stale:
            failures.append('stale object: '+str(obj)+' (source '+str(source)+')')
    return {'status':'FAIL' if failures else 'PASS', 'checked':len(findings),
            'findings':findings, 'errors':failures,
            'limitation':'Timestamps do not prove compiler flags or source-byte identity.'}


def main():
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('--source',type=Path,action='append',required=True)
    a.add_argument('--object',type=Path,action='append',required=True)
    a.add_argument('--output',type=Path)
    args=a.parse_args()
    if len(args.source)!=len(args.object):
        a.exit(2,'Source and object list lengths differ\n')
    result=check_pairs(zip(args.source,args.object))
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps(result,indent=2))
    if result['status']!='PASS':
        sys.exit(2)

if __name__=='__main__':main()
