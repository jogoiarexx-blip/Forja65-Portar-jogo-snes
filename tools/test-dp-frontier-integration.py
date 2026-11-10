#!/usr/bin/env python3
"""End-to-end apply smoke in isolated staging project, never edits real port."""
from pathlib import Path
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
ROOT=Path(__file__).resolve().parent.parent
CURRENT=Path(sys.argv[1]).resolve()
ZIP=Path(sys.argv[2]).resolve()
ROM=CURRENT/'assets/cart-data.bin'
DIAG=CURRENT/'diagnosticos-v04246/v04246-updated'
with tempfile.TemporaryDirectory(prefix='forja-dp-integration-') as temp:
    root=Path(temp);project=root/'game';(project/'src').mkdir(parents=True)
    (project/'assets').mkdir()
    with zipfile.ZipFile(ZIP) as z:
        root_name=z.namelist()[0].split('/')[0]
        (project/'src/dispatch.cpp').write_bytes(z.read(root_name+'/src/dispatch.cpp'))
        (project/'CMakeLists.txt').write_bytes(z.read(root_name+'/CMakeLists.txt'))
    shutil.copy2(ROM,project/'assets/cart-data.bin')
    cmd=[sys.executable,str(ROOT/'tools/resolve-dp-indirect-frontier.py'),
         '--forja',str(ROOT),'--rom',str(ROM),'--project',str(project),'--diagnostics',str(DIAG),
         '--out',str(root/'generated'),'--apply']
    result=subprocess.run(cmd,capture_output=True,text=True)
    assert result.returncode==0, result.stderr
    report=json.loads(result.stdout)
    merged=report['integration']
    assert merged['new_instruction_sites']==6 and merged['new_dispatch_rows']==12
    assert merged['added_rom_aliases']==6 and merged['address_overlap']==0
    staged=(project/'src/dispatch.cpp').read_text().splitlines()
    final=(CURRENT/'src/dispatch.cpp').read_text().splitlines()
    assert set(staged).issubset(set(final)), 'Later JSR integration must not change existing DP dispatcher rows'
    assert (project/'src/forja_b9aaee.cpp').read_bytes()==(CURRENT/'src/forja_b9aaee.cpp').read_bytes()
    assert (project/'CMakeLists.txt').read_text()==(CURRENT/'CMakeLists.txt').read_text().replace('src/forja_b6f3eb.cpp ',''), 'Additional direct JSR must only append a source unit'
    stale=subprocess.run([*cmd[:-3],'--out',str(root/'generated2')],capture_output=True,text=True)
    assert stale.returncode!=0 and 'already integrated' in stale.stderr.lower(),stale.stderr
print('DP_FRONTIER_INTEGRATION_PASS: staged auto-generation and opt-in merge byte-identical to DKC3, duplicates rejected')
