import struct
def read_trace(path):
    ev=[];env={}
    for l in open(path):
        if l.startswith('# FORJA65_ENV '):
            k,v=l[14:].strip().split('=',1); env[k]=v
        if l.startswith('frame='): ev.append((int(l.split()[0][6:]),int(l.split('joy1=')[1].split()[0],16)))
    return ev,env
def mask_at(ev,f):
    m=0
    for fr,mm in ev:
        if fr>f: break
        m=mm
    return m
def advance(r,p,ev,f,F):
    while f<F:
        n=F-f; nxt=[fr for fr,_ in ev if f<fr<F]
        if nxt: n=nxt[0]-f
        m=mask_at(ev,f); r.run(n,m); p.run(n,m); f+=n
def parse(path):
    b=open(path,'rb').read(); assert b[:6]==b'FJDMP1'
    fr,=struct.unpack_from('<Q',b,8); regs=struct.unpack_from('<10I',b,16); o=56
    d=dict(frame=fr,pc=regs[0],a=regs[1],x=regs[2],y=regs[3],s=regs[4],d=regs[5],db=regs[6],p=regs[7],e=regs[8],v=regs[9])
    d['wram']=b[o:o+0x20000]; o+=0x20000; d['vram']=b[o:o+0x10000]; o+=0x10000; d['oam']=b[o:o+544]; o+=544; d['cgram']=b[o:o+512]; o+=512
    d['w'],d['h']=struct.unpack_from('<II',b,o); o+=8; d['fb']=b[o:o+d['w']*d['h']*4]; return d
def dump_both(r,p,prefix):
    r.cmd('dump '+prefix+'.r'); p.cmd('dump '+prefix+'.p'); return parse(prefix+'.r'),parse(prefix+'.p')
