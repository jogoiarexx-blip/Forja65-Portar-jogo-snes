#!/usr/bin/env python3
"""Reproduces clean control, subprocess crash and protocol reject without a ROM."""
from pathlib import Path
import tempfile
import os
from portemu import PortEmu

def script(root,src,name):
    path=root/name
    path.write_text('#!/usr/bin/env python3\n'+src,encoding='utf8')
    path.chmod(0o755)
    return path

def test():
    with tempfile.TemporaryDirectory(prefix='forja-port-test-') as temp:
        root=Path(temp);assets=root/'assets';assets.mkdir()
        crash=script(root,'import sys\nprint("CFG dispatch crash 0xC0FFEE",file=sys.stderr)\nsys.exit(7)\n','crash.py')
        try:PortEmu(str(crash),str(assets))
        except RuntimeError as e:
            assert 'code=7' in str(e) and 'CFG dispatch crash' in str(e),str(e)
        else:raise AssertionError('startup failure was not reported')
        ok=script(root,'''import sys
print("ready 0",flush=True)
for line in sys.stdin:
 if line.strip()=="quit":break
 if line.startswith("run "):print("ok 2",flush=True)
 elif line.strip()=="frame":print("0",flush=True)
 else:print("error unsupported command",flush=True)
''','ok.py')
        ctl=PortEmu(str(ok),str(assets))
        assert ctl.frame()==0
        assert ctl.run(2,0)=='ok 2'
        try:ctl.cmd('bad')
        except RuntimeError as e:assert 'rejected' in str(e)
        else:raise AssertionError('rejected command was accepted')
        ctl.close()
    print('PASS portemu: stderr crash, exit status, response validation, close')

if __name__=='__main__':test()
