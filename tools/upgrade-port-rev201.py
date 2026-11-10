#!/usr/bin/env python3
"""Upgrade a previously generated Forja65 REV199/REV200 native port's shared runtime.
No ROM/CFG/CPU/PPU generation takes place. Keeps a backup of the original runtime.hpp.
Usage: python tools/upgrade-port-rev201.py /path/to/port
"""
import argparse
import hashlib
from pathlib import Path
import shutil
import sys
from rev201_runtime_patch import patch_runtime

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project',type=Path,help='Generated port root containing src/runtime.hpp')
    parser.add_argument('--dry-run',action='store_true')
    args=parser.parse_args()
    project=args.project.resolve()
    target=project/'src/runtime.hpp'
    if not target.is_file():
        parser.error(f'Could not find generated runtime: {target}')
    source=target.read_text(encoding='utf-8')
    if 'REV201: keyboard stays player 1' in source:
        print('ALREADY_REV201',target);return 0
    try:
        changed=patch_runtime(source)
    except AssertionError as error:
        print(f'INCOMPATIBLE_RUNTIME: {error}. No file changed.',file=sys.stderr)
        return 2
    if args.dry_run:
        print('WOULD_UPGRADE',target);return 0
    backup=target.with_name('runtime.hpp.pre-rev201.bak')
    if backup.exists():
        print(f'Backup already exists, refusing to overwrite: {backup}',file=sys.stderr)
        return 3
    shutil.copy2(target,backup)
    staged=target.with_name('runtime.hpp.rev201.tmp')
    try:
        staged.write_text(changed,encoding='utf-8')
        staged.replace(target)
    finally:
        if staged.exists():staged.unlink()
    cmake=project/'CMakeLists.txt'
    if cmake.is_file() and not ('winmm' in cmake.read_text(encoding='utf-8') and 'xinput' in cmake.read_text(encoding='utf-8').lower()):
        print('WARNING: review Windows game target links: user32 gdi32 xinput9_1_0 winmm')
    print('UPGRADED',target)
    print('BACKUP',backup)
    print('REBUILD: use your port BUILD-WINDOWS.cmd; updating sources does not update game.exe')
    return 0
if __name__=='__main__':sys.exit(main())
