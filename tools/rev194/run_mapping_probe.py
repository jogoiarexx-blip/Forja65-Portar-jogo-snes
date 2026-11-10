#!/usr/bin/env python3
"""Forja65 REV194 - roda as ROMs-sonda de mapeamento numa referencia libretro (refemu) ou num port Forja65
(modo de controle) e grava a tabela {endereco SNES: byte lido}.

uso:
  run_mapping_probe.py ref  REFEMU CORE.so ROM.sfc PROBES.json SAIDA.json
  run_mapping_probe.py port PORT_DIR ROM.sfc PROBES.json SAIDA.json   (PORT_DIR com game e assets/)
"""
import json, os, subprocess, sys, tempfile, shutil

def parse_ram(text):
    for line in text.splitlines()[::-1]:
        line = line.strip()
        if line and all(c in '0123456789abcdef' for c in line.lower()) and len(line) % 2 == 0:
            return bytes.fromhex(line)
    raise RuntimeError('saida sem dump de RAM: ' + text[-400:])

def main():
    mode = sys.argv[1]
    if mode == 'ref':
        refemu, core, rom, probes, out = sys.argv[2:7]
        P = json.load(open(probes))['probes']
        n = len(P) * 4
        cmds = 'run 20 0000\nram 2000 %x\nram fffc 1\nquit\n' % n
        r = subprocess.run([refemu, core, rom], input=cmds, capture_output=True, text=True, timeout=120)
        lines = [l for l in r.stdout.splitlines() if l.strip() and all(c in '0123456789abcdef' for c in l.strip().lower())]
        data = bytes.fromhex(lines[-2].strip()); done = bytes.fromhex(lines[-1].strip())[0]
    else:
        port, rom, probes, out = sys.argv[2:6]
        P = json.load(open(probes))['probes']
        n = len(P) * 4
        run = tempfile.mkdtemp(prefix='forja-map-')
        try:
            os.symlink(os.path.join(port, 'assets'), os.path.join(run, 'assets'))
            env = dict(os.environ, FORJA65_CONTROL='1', FORJA65_HEADLESS='1', FORJA65_HEADLESS_FRAMES='0',
                       FORJA65_WATCHDOG_INSTRUCTIONS='0', FORJA65_EXECUTION='reference', FORJA65_SPC_PROFILE='reference',
                       FORJA65_CONTROL_DIR=os.path.join(run, 'ctl'))
            cmds = 'run 20 0000\nram 2000 %x\nram fffc 1\nquit\n' % n
            r = subprocess.run([os.path.join(port, 'game')], input=cmds, capture_output=True, text=True, timeout=300, cwd=run, env=env)
            lines = [l for l in r.stdout.splitlines() if l.strip() and all(c in '0123456789abcdef' for c in l.strip().lower())]
            if len(lines) < 2:
                raise RuntimeError('port sem dump: ' + (r.stdout + r.stderr)[-600:])
            data = bytes.fromhex(lines[-2].strip()); done = bytes.fromhex(lines[-1].strip())[0]
        finally:
            shutil.rmtree(run, ignore_errors=True)
    res = {'finished': done == 0x77, 'reads': {}}
    for i, (a, op) in enumerate(P):
        res['reads']['%06X%s' % (a, 'w' if op else '')] = data[4 * i]
    json.dump(res, open(out, 'w'), indent=0)
    print(out, 'fim' if res['finished'] else 'NAO TERMINOU', len(P))

if __name__ == '__main__':
    main()
