import copy
import hashlib
import importlib.util
import pathlib

TOOL = pathlib.Path(__file__).resolve().parents[1] / 'tools/audit-indexed-jmp-frontier.py'
spec = importlib.util.spec_from_file_location('frontier', TOOL)
frontier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frontier)

# Tiny deterministic synthetic HiROM fixture with four table words,
# and executable bytes starting at the first table target.
rom = bytearray([0xff] * 65536)
rom[0x8000:0x8003] = bytes((0x7c,0x03,0x80))
rom[0x8003:0x800b] = bytes((0x0b,0x80,0x11,0x80,0x14,0x80,0x17,0x80))
rom[0x800b] = 0xea
rom[0x8011] = 0x60
rom[0x8014] = 0x6b
rom[0x8017] = 0x4c
hashval = hashlib.sha256(rom).hexdigest()
witness = {'schema':'forja65.rom-indexed-jmp-audit.v1','mapper':'HiROM',
           'rom_sha256':hashval,'callsite':'C08000','pointer_base':'8003','opcode':'7C',
           'routes':[{'observed_x':'0000','table_address':'C08003','target':'C0800B',
                      'target_first_opcode':'EA'}]}
r = frontier.scan(rom, witness, trace_indices={0})
assert r['candidate_count'] == 4 and r['witnessed_count'] == 1
assert [v['target'] for v in r['routes']] == ['C0800B','C08011','C08014','C08017']
assert r['routes'][0]['status']=='trace_index_witness_rom_target'
assert all(v['status']=='candidate_from_bounded_rom_table_unexecuted' for v in r['routes'][1:])
unverified = frontier.scan(rom, witness)
assert unverified['witnessed_count'] == 0 and unverified['routes'][0]['status']=='externally_supplied_index_rom_verified_only'
for mutant in ('badsha','badpointer','badopcode','missing_anchor','badlimit'):
    bad=copy.deepcopy(witness)
    if mutant=='badsha':bad['rom_sha256']='0'*64
    if mutant=='badpointer':bad['routes'][0]['target']='C0800C'
    if mutant=='badopcode':bad['opcode']='20'
    if mutant=='missing_anchor':bad['routes'][0]['observed_x']='0002'
    if mutant=='badlimit':bad['routes'][0]['target']='C08003'
    try: frontier.scan(rom,bad)
    except ValueError:pass
    else:raise AssertionError('Invalid proof accepted: '+mutant)
try: frontier.scan(rom,witness,100)
except ValueError:pass
else:raise AssertionError('Unbounded request accepted')
print('INDEXED_JMP_FRONTIER_PASS cases=7 bounded_candidates=4 witnessed=1')
