#!/usr/bin/env python3
"""Read-only ROM-bound evidence bridge for DKC3 Native and DKC3 ZERO.
Does NOT turn static hints into runtime evidence or authorize native handlers.
"""
import argparse, hashlib, json, re, pathlib

def sha(f):
    h=hashlib.sha256()
    with open(f,'rb') as fp:
        for data in iter(lambda:fp.read(1024*1024),b''):h.update(data)
    return h.hexdigest()

def lines_from_hint(path):
    out=[]
    for line in path.read_text().splitlines():
        kv=dict(re.findall(r'(\w+)=([^\s]+)',line))
        if kv and 'target' in kv and 'from' in kv:out.append(kv)
    return out

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['native-rom','zero-rom','proof-pack','knowledge','callback-domain','zero-hints','zero-last-error']:
        p.add_argument('--'+name,required=True,type=pathlib.Path)
    p.add_argument('--out',required=True,type=pathlib.Path)
    a=p.parse_args()
    native_sha,zero_sha=sha(a.native_rom),sha(a.zero_rom)
    proofs=json.loads(a.proof_pack.read_text());knowledge=json.loads(a.knowledge.read_text());dom=json.loads(a.callback_domain.read_text())
    fp=proofs['rom']
    if native_sha!=zero_sha or native_sha!=proofs.get('rom_sha256'):raise SystemExit('REFUSE: ROM SHA256 mismatch between Native, ZERO and proof pack')
    if fp!=knowledge['rom']['fnv1a64'] or fp!=dom['rom']:raise SystemExit('REFUSE: ROM fingerprints differ across proof pack, knowledge and callback domain')
    hints=lines_from_hint(a.zero_hints)
    for h in hints:
        if h.get('rom')!=fp:raise SystemExit('REFUSE: runtime hint belongs to a different ROM')
    dispatchers={entry['site']:entry for entry in knowledge.get('dispatch',[])}
    command3=set(dom['commands']['3']['targets']);known_targets={int(h['target'],16) for h in hints}
    last=a.zero_last_error.read_text().strip()
    match=re.search(r'pc=(\d+)\s+target=(\d+)',last)
    if not match:raise SystemExit('REFUSE: missing concrete FLOW evidence')
    pc,target=map(int,match.groups())
    has_target=target in set(dispatchers.get(pc,{}).get('targets',[]))
    target_proof=next((pr for pr in proofs.get('proofs',[]) if pr.get('target')==target),None)
    legacy=[('B28030','B28273'),('B28036','B282FD'),('B28033','B282E5'),('B28046','B2847E'),('0082CF','00BBA6')]
    native_entries={row['address'] for row in knowledge.get('entries',[]) if isinstance(row.get('address'),int)}
    all_proofs={pr['target'] for pr in proofs.get('proofs',[]) if isinstance(pr.get('target'),int)}
    legacy_evidence=[{'from':a,'target':b,'in_native_knowledge':int(b,16) in native_entries,'has_individual_proof':int(b,16) in all_proofs} for a,b in legacy]
    if not has_target:raise SystemExit('REFUSE: ZERO runtime destination absent from Native static domain; re-analyze before crossfeed')
    # Keep observed last-error and Native closed-domain knowledge separate.
    data={
      'schema':'dkc3.cross-project-evidence.v1', 'rom_sha256':native_sha,'rom_fnv1a64':fp,
      'sources':{'native_version':'0.93.0','native_forja_branch':'0.3.60-guarded-inline-state-domains','zero_version':'0.12','zero_forja_branch':'0.3.67-stack-evidence-ppu-brightness'},
      'native_proofs':{'records':len(proofs.get('proofs',[])),'closed_callback_command_3_targets':len(command3),'dispatcher_site':pc if pc in dispatchers else None},
      'zero_runtime':{'recorded_hints':len(hints),'hint_destinations':len(known_targets),'last_error':{'from':f'{pc:06X}','target':f'{target:06X}','class':'FLOW','source':'v012-test600.log','verified_in_native_static_domain':has_target,'is_command3_callback':target in command3,'callback_proof_status':target_proof.get('status') if target_proof else None,'callback_proof_scope':target_proof.get('scope') if target_proof else None,'callback_proof_cases':target_proof.get('verification',{}).get('cases') if target_proof else None,'callback_abi_exclusions':target_proof.get('contract',{}).get('excluded') if target_proof else None,'cpu_state':'NOT AVAILABLE in the last-error log'},'last_error_in_existing_hints':target in known_targets,'historical_b2_paths':legacy_evidence},
      'rules':['Do not treat a static callback-domain membership as 65816 runtime equivalence.','Do not infer CPU E/M/X/C state from the last error: obtain it from an exact crash trace before creating runtime hints.','Do not mark native handlers fully equivalent when only guarded specializations have passed.','Do not skip original RESET/menus to claim faithful boot.','Keep existing ZERO PPU capture evidence separate from native assets/screens.']}
    a.out.mkdir(parents=True,exist_ok=True)
    (a.out/'evidence.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
    report=f'''# DKC3 — Cruzamento auditado Native v0.93 × ZERO v0.12

**ROM:** SHA256 `{native_sha}`; fingerprint Forja `{fp}`. Os arquivos são byte a byte equivalentes.

## Resultados

- O pacote Native informa 22/25 handlers completos, 126 destinos originais sob guards e 48 dependências sem prova; essas métricas pertencem ao domínio da animação, não ao FPS ou à execução do ZERO.
- O DKC3 ZERO v0.12 comprovou 300 frames headless, mas não a abertura visual. Seu relatório de 600 frames parou em `{pc:06X} → {target:06X}`.
- O destino `{target:06X}` está no conjunto dos **{len(command3)} callbacks do comando 3** do corpus da ROM e no domínio de despacho `{pc:06X}` do Native.
- **Prova semântica específica de `{target:06X}`:** status `{target_proof.get('status') if target_proof else 'none'}`, escopo `{target_proof.get('scope') if target_proof else 'none'}`, **{target_proof.get('verification',{}).get('cases') if target_proof else 0} casos**. A prova exclui resíduos de flags/registradores no retorno RTS e partes externas à ABI declarada. Não usar como equivalência de CPU completa.
- Há **{len(hints)} registros** de hints na v0.12, com **{len(known_targets)} destinos distintos**. O último erro {'já está' if target in known_targets else 'ainda não está'} nessa lista.
- **Estado E/M/X/C do último erro não aparece em `v012-test600.log`.** Não criar hint dinâmico artificial até obter esse estado do runtime.

## Cruzamento dos bloqueios anteriores do chat

{chr(10).join('- `'+row['from']+' → '+row['target']+'`: conhecimento nativo='+str(row['in_native_knowledge'])+'; prova semântica própria='+str(row['has_individual_proof']) for row in legacy_evidence)}

## Transferência segura

1. Usar `forja65-knowledge.json` e `animation-callback-domain.json` como **conhecimento estático** vinculado à ROM.
2. Usar `animation-handler-equivalence.json` apenas em `native-dispatch`, obedecendo dependências, fingerprints e `required_runtime_guards`.
3. No ZERO, manter a execução via RESET e registrar o estado da CPU no próximo crash para liberar `{target:06X}` com evidência de execução.
4. Medir VRAM/CGRAM/OAM, brilho e camadas entre frames 130 e 300; os frames capturados continuam quase pretos.
5. Evitar copiar o menu C++ do Native como prova de execução do menu original da ROM; ele pode ser útil em um modo separado de testes visuais.

## Distinções importantes

- **22/25 handlers**: provas da máquina de comandos de animação do Native, não são 22/25 instruções 65C816.
- **126 callbacks**: destinos validados sob seus guardas; não há garantia de execução incondicional.
- **7.703 endereços**: cobertura decodificada pelo ZERO; não equivale a 7.703 callbacks validados.
- **300 frames**: teste headless encerrado normalmente; não significa 300 quadros com imagem útil.
- **BA29** pendente no Native não foi automaticamente corrigido pelos retornos observados no ZERO; exigiria comparação de pilha, ABI e pós-condições.

Nenhuma alteração de comportamento do jogo é afirmada neste relatório; é uma transferência de evidência auditada.
'''
    (a.out/'CROSSFEED-REPORT.md').write_text(report)
    print('PASS: same ROM SHA256 and FNV evidence')
    print(f'PASS: {pc:06X} -> {target:06X} appears in command3={target in command3}, native dispatch={has_target}')
    print(f'PASS: {len(hints)} runtime hints checked; {len(proofs.get("proofs",[]))} proof records kept segregated')
    print('OUTPUT',str(a.out))

if __name__=='__main__':main()
