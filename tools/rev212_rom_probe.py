#!/usr/bin/env python3
"""REV212: independent, read-only SNES cartridge preflight (no game data emitted).

Header heuristics are deliberately conservative: ROM identity is the SHA-256
of the *input file*, while copier headers and ambiguous mapping are reported.
This is not a complete coprocessor detector or a substitute for an emulator.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

SCHEMA = 'forja65.rom-probe.v1'
HEADER_LOCATIONS = [('LoROM', 0x7FC0), ('HiROM', 0xFFC0), ('ExHiROM', 0x40FFC0)]
MAP_NAMES = {0x20:'LoROM', 0x30:'LoROM', 0x21:'HiROM', 0x31:'HiROM',
             0x25:'ExHiROM', 0x35:'ExHiROM', 0x23:'LoROM', 0x33:'LoROM'}


def _header_candidate(payload: bytes, family: str, offset: int) -> dict | None:
    if len(payload) < offset + 64:
        return None
    h = payload[offset:offset+64]
    title_bytes = h[:21].rstrip(b' \0')
    ascii_ok = bool(title_bytes) and all(32 <= c < 127 for c in title_bytes)
    title = title_bytes.decode('ascii', 'replace') if ascii_ok else None
    mm = h[0x15]
    reported = MAP_NAMES.get(mm)
    complement = int.from_bytes(h[0x1c:0x1e], 'little')
    checksum = int.from_bytes(h[0x1e:0x20], 'little')
    complement_valid = (complement ^ checksum) == 0xffff and checksum not in (0, 0xffff)
    reset = int.from_bytes(h[0x3c:0x3e], 'little')
    # The reset vector must point into the upper half of the bank in these layouts.
    score = (4 if complement_valid else 0) + (3 if reported == family else 0) \
            + (2 if ascii_ok else 0) + (1 if reset >= 0x8000 else 0)
    return {'layout':family, 'header_offset':offset, 'title':title, 'map_mode':f'{mm:02X}',
            'map_reported':reported or 'unknown', 'cartridge_type':f'{h[0x16]:02X}',
            'rom_size_exponent':h[0x17], 'sram_size_exponent':h[0x18],
            'region_code':h[0x19], 'reset_vector':f'{reset:04X}',
            'nmi_vector':f'{int.from_bytes(h[0x3a:0x3c], "little"):04X}',
            'checksum_complement_valid':complement_valid, 'header_score':score}


def probe(path: Path) -> dict:
    path = Path(path)
    content = path.read_bytes()
    if not content:
        raise ValueError('ROM vazia')
    copier = len(content) % 32768 == 512
    payload = content[512:] if copier else content
    candidates = [c for fam, ofs in HEADER_LOCATIONS if (c := _header_candidate(payload,fam,ofs))]
    candidates.sort(key=lambda c:c['header_score'],reverse=True)
    best = candidates[0] if candidates and candidates[0]['header_score'] >= 5 else None
    warnings = []
    if copier:
        warnings.append('Arquivo inclui 512 bytes iniciais adicionais; confirmar se o gerador interpreta esse header.')
    if len(payload) % 32768:
        warnings.append('Tamanho nao multiplo de 32 KiB: dump de ROM nao convencional ou corrompido.')
    if best is None:
        warnings.append('Cabecalho SNES nao reconhecido com confianca; conferir mapeamento/vetores manualmente.')
    elif not best['checksum_complement_valid']:
        warnings.append('Complemento do checksum do cabecalho invalido; pode ser hack/dump alterado.')
    if len(candidates)>1 and candidates[0]['header_score']==candidates[1]['header_score'] and best:
        warnings.append('Cabecalho ambiguo: mais de um layout possui a mesma pontuacao.')
    chip='unconfirmed'
    if best:
        mm=int(best['map_mode'],16)
        ct=int(best['cartridge_type'],16)
        if mm in (0x23,0x33):
            chip='SA-1 (sugerido pelo modo de mapeamento)'
        elif ct in (0x13,0x14,0x15,0x1a):
            chip='SuperFX (suspeita por cartridge type; verificar manualmente)'
        elif ct in (0x03,0x05,0xf3):
            chip='DSP/RTC/ou expansao (verificar chip e pinagem manualmente)'
        elif ct in (0x00,0x01,0x02):
            chip='sem chip adicional (estimado)'
    return {'schema':SCHEMA, 'file_name':path.name, 'file_size':len(content),
            'payload_size':len(payload), 'sha256':hashlib.sha256(content).hexdigest(),
            'copier_header_512':copier, 'cartridge':best, 'possible_chip':chip,
            'warnings':warnings, 'candidates':candidates}


def concise(result: dict) -> str:
    c=result['cartridge'] or {}
    return (f"ROM: {result['file_name']}\nSHA-256: {result['sha256']}\n"
            f"Cabecalho: {c.get('layout','desconhecido')}  titulo: {c.get('title','?')} "
            f"reset: {c.get('reset_vector','?')}  chip: {result['possible_chip']}\n"
            + ''.join('AVISO: '+w+'\n' for w in result['warnings']))


def main(argv=None):
    import argparse
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('rom',type=Path)
    ap.add_argument('--json',type=Path)
    a=ap.parse_args(argv)
    try:
        result=probe(a.rom)
        if a.json:
            a.json.parent.mkdir(parents=True,exist_ok=True)
            a.json.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        print(concise(result))
        return 0
    except (OSError,ValueError) as exc:
        ap.exit(2,f'ERRO: {exc}\n')

if __name__=='__main__':
    raise SystemExit(main())
