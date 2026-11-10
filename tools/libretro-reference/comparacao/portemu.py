"""Forja65 REV134 - cliente do modo de controle do PROPRIO port (FORJA65_CONTROL=1).

Mesma interface do emu.py (run/save/load/ram/w16/shot/frame/trace), entao as buscas
(stage-search.py, mcbot, go-explore) rodam direto no port gerado pelo Forja. Savestates sao
processos pausados (fork) - so Linux/macOS.

Variaveis: FORJA65_PORT_GAME (executavel), FORJA65_PORT_ASSETS (pasta assets do port).
"""
import os, subprocess, tempfile
B=0x8000;Y=0x4000;SEL=0x2000;START=0x1000;UP=0x0800;DOWN=0x0400;LEFT=0x0200;RIGHT=0x0100;A=0x0080;X=0x0040;L=0x20;R=0x10
class PortEmu:
    def __init__(s,game=None,assets=None,extra_env=None):
        game=game or os.environ.get("FORJA65_PORT_GAME","build/game")
        assets=assets or os.environ.get("FORJA65_PORT_ASSETS","assets")
        s.dir=tempfile.mkdtemp(prefix="forja-portemu-")
        os.symlink(os.path.abspath(assets),os.path.join(s.dir,"assets"))
        env=dict(os.environ,FORJA65_CONTROL="1",FORJA65_HEADLESS="1",FORJA65_HEADLESS_FRAMES="0",
                 FORJA65_EXECUTION="reference",FORJA65_SPC_PROFILE="reference",FORJA65_WATCHDOG_INSTRUCTIONS=os.environ.get("FORJA65_WATCHDOG_INSTRUCTIONS","0"),
                 FORJA65_SRAM_PATH=os.path.join(s.dir,"save.srm"),FORJA65_CONTROL_DIR=os.path.join(s.dir,"ctl"))
        env.pop("FORJA65_INPUT_REPLAY",None)
        if extra_env: env.update(extra_env)
        # Keep the child's stderr; silently dropping startup crashes made broken ports
        # indistinguishable from missing assets or a protocol failure.
        s.stderr_path=os.path.join(s.dir,'forja-port-stderr.log')
        s.stderr_file=open(s.stderr_path,'w+',encoding='utf8')
        s.p=subprocess.Popen([os.path.abspath(game)],cwd=s.dir,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=s.stderr_file,text=True,bufsize=1)
        while True:
            l=s.p.stdout.readline()
            if not l:
                s.stderr_file.flush()
                with open(s.stderr_path,encoding='utf8',errors='replace') as err:
                    detail=err.read()[-1800:]
                raise RuntimeError(f"native port terminated before ready (code={s.p.poll()}): {detail or '[no stderr]'}")
            if l.startswith("ready"): s.fr=int(l.split()[1]); break
    def cmd(s,c):
        if s.p.poll() is not None:
            raise RuntimeError(f"native port exited (code={s.p.returncode}) during command {c!r}; stderr={s.stderr_path}")
        s.p.stdin.write(c+"\n"); s.p.stdin.flush()
        answer=s.p.stdout.readline().strip()
        if not answer:
            raise RuntimeError(f"native port closed control channel on {c!r}; stderr={s.stderr_path}")
        if answer.startswith(("error", "ERROR", "fatal", "FATAL")):
            raise RuntimeError(f"native port rejected {c!r}: {answer}")
        return answer
    def run(s,n,mask=0):
        r=s.cmd(f"run {n} {mask:04x}"); return r
    def trace(s,path,until):
        ev=[]
        for l in open(path):
            if l.startswith("frame="): ev.append((int(l.split()[0][6:]),int(l.split("joy1=")[1].split()[0],16)))
        cur=0;f=s.frame()
        for fr,j in ev:
            if fr>=until: break
            if fr>f: s.run(fr-f,cur); f=fr
            cur=j
        if until>f: s.run(until-f,cur)
        return "ok"
    def save(s,k): return s.cmd(f"save {k}")
    def load(s,k): return s.cmd(f"load {k}")
    def delete(s,k): return s.cmd(f"del {k}")
    savefile=save; loadfile=load
    def ram(s,a,n): return bytes.fromhex(s.cmd(f"ram {a:x} {n:x}"))
    def w16(s,a): b=s.ram(a,2); return b[0]|b[1]<<8
    def shot(s,p): return s.cmd(f"shot {p}")
    def frame(s): return int(s.cmd("frame"))
    def close(s):
        try:
            if s.p.poll() is None:
                s.p.stdin.write("quit\n"); s.p.stdin.flush()
                try:s.p.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    s.p.kill();s.p.wait(timeout=3)
        except (OSError,ValueError,BrokenPipeError):pass
        finally:
            s.stderr_file.close()
