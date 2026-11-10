from emu import *
def slots(e):
  m=e.ram(0x800,0x1000);out=[]
  for k in range(0,24):
    b=0x88a+k*0x6E-0x800-0x12
    s=m[b:b+0x6E]; x=s[0x12]|s[0x13]<<8; y=s[0x16]|s[0x17]<<8
    t=s[2:4].hex()
    if (x or y) and t not in ('24d4',): out.append((k,t,x,y))
  return out
