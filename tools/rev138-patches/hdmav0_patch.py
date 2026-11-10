"""REV138: a primeira transferencia de HDMA acontece no HBlank de V=0 (antes da 1a linha visivel, V=1).
O port faz a preparacao (setup) na linha 0 dele, que e V=1, e so transferia no HBlank dessa linha: todo efeito de
HDMA (janelas, gradientes, Mode 7 por linha) ficava uma linha abaixo da referencia. Agora o setup faz tambem a
transferencia de V=0. FORJA65_HDMA_V0_TRANSFER=0 volta ao antigo."""
A=("      primeHdmaChannel(ch);reloadHdmaChannel(ch);\n    }\n  }\n  void executeHdmaLine(){")
B=("      primeHdmaChannel(ch);reloadHdmaChannel(ch);\n    }\n"
   "    // REV138: transferencia do HBlank de V=0 (a linha 0 do port ja e V=1).\n"
   "    static const bool v0=[](){const char*e=std::getenv(\"FORJA65_HDMA_V0_TRANSFER\");return !(e&&*e=='0');}();\n"
   "    if(v0&&hdmaActive){hdmaPrelineTransfer=true;executeHdmaLine();hdmaPrelineTransfer=false;hdmaExecutedThisLine=false;} // a linha 0 do port (V=1) ainda tem a propria transferencia\n  }\n  void executeHdmaLine(){")
def patch(t):
    if 'FORJA65_HDMA_V0_TRANSFER' in t: return t
    assert t.count(A)==1,t.count(A); return t.replace(A,B,1)

if __name__=='__main__':
    import sys
    for p in sys.argv[1:]:
        s=open(p).read(); n=patch(s)
        with open(p,'w') as f: f.write(n)
        print(p,'ok')
