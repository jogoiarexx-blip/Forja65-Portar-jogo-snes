"""Cliente Python do refemu (Forja65 REV133). Variaveis: FORJA65_REFEMU, FORJA65_LIBRETRO_CORE, FORJA65_ROM."""
import os, subprocess
REFEMU=os.environ.get("FORJA65_REFEMU",os.path.join(os.path.dirname(__file__),"refemu"))
CORE=os.environ.get("FORJA65_LIBRETRO_CORE","snes9x_libretro.so")
ROM=os.environ.get("FORJA65_ROM","")
class Emu:
    def __init__(s,rom=None,core=None):
        s.p=subprocess.Popen([REFEMU,core or CORE,rom or ROM],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,bufsize=1)
        while True:
            l=s.p.stdout.readline()
            if not l: raise RuntimeError("refemu encerrou antes de ficar pronto (core/ROM?)")
            if l.strip()=="ready": break
    def cmd(s,c): s.p.stdin.write(c+"\n"); s.p.stdin.flush(); return s.p.stdout.readline().strip()
    def run(s,n,mask=0): return s.cmd(f"run {n} {mask:04x}")
    def trace(s,path,until): return s.cmd(f"trace {path} {until}")
    def save(s,k): s.cmd(f"save {k}")
    def load(s,k): s.cmd(f"load {k}")
    def savefile(s,p): s.cmd(f"savefile {p}")
    def loadfile(s,p): s.cmd(f"loadfile {p}")
    def ram(s,a,n): return bytes.fromhex(s.cmd(f"ram {a:x} {n:x}"))
    def w16(s,a): b=s.ram(a,2); return b[0]|b[1]<<8
    def shot(s,p): s.cmd(f"shot {p}")
    def frame(s): return int(s.cmd("frame"))
B=0x8000;Y=0x4000;SEL=0x2000;START=0x1000;UP=0x0800;DOWN=0x0400;LEFT=0x0200;RIGHT=0x0100;A=0x0080;X=0x0040;L=0x20;R=0x10
