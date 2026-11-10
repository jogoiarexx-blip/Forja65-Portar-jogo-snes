#!/usr/bin/env python3
"""Merge only ROM-decoded, observed functions into an existing Forja65 native port.

This is a source integration tool, not a gameplay bypass. The caller must first
produce a focused Forja65 generation for an actual runtime FLOW observation.
Refuses unverified overlaps and missing/generated symbols rather than guessing coverage.
"""
import argparse
import json
import re
from pathlib import Path


def code_functions(shard, routine):
    pattern = re.compile(r'^void (sub_'+routine+r'_E\w+)\(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc\) \{', re.M)
    spans = list(pattern.finditer(shard))
    if not spans:
        raise ValueError('observed routine is absent from generated shard')
    result=[]
    for m in spans:
        depth=0; in_string=False; escape=False; end=None
        # Forja emission contains C++ strings; balanced braces suffice for its generated output.
        for i in range(m.end()-1,len(shard)):
            ch=shard[i]
            if ch=='{' : depth+=1
            elif ch=='}':
                depth-=1
                if depth==0: end=i+1;break
        if end is None: raise ValueError('unterminated generated routine')
        result.append((m.group(1),shard[m.start():end]))
    if len(set(n for n,_ in result))!=len(result):raise ValueError('duplicate function generated')
    return result


def get_array(s, tag):
    m=re.search(r'(static const '+tag+r' kForja65(?:Aliases|Dispatch)\[\]=\{\n)(.*?)(\n\};)',s,re.S)
    if not m:raise ValueError('generated dispatch array missing '+tag)
    return m


def validate_proof(proof_file, routine, funcs, newpcs, expected_rom=None):
    """Reject inconsistent ROM-decoder evidence before touching port sources.

    Legacy hand-built fixtures without a proof are allowed unless --proof is
    explicitly supplied. Real focused generation produces proof.json.
    """
    if proof_file is None:
        return
    proof = json.loads(Path(proof_file).read_text())
    if proof.get('schema') != 1 or proof.get('routine') != routine:
        raise ValueError('proof schema / requested routine mismatch')
    rom = proof.get('rom')
    if not isinstance(rom, str) or not re.fullmatch(r'[0-9a-f]{16}', rom):
        raise ValueError('missing or invalid source ROM fingerprint')
    if expected_rom is not None and rom.lower() != expected_rom.lower():
        raise ValueError('source ROM fingerprint does not match expected ROM')
    decoded = proof.get('decoded')
    # Long ROM routines may be split into multiple _partN functions by the
    # Forja emitter. Each part is a C++ unit, NOT another CPU-state variant.
    # Count unique state signatures, and require the initial _part0 for each.
    names = [name for name, _ in funcs]
    roots = {re.sub(r'_part[0-9]+$', '', name) for name in names}
    for root in roots:
        pieces = {int(m.group(1)) for name in names
                  if (m := re.fullmatch(re.escape(root) + r'_part([0-9]+)', name))}
        if pieces and pieces != set(range(max(pieces) + 1)):
            raise ValueError('incomplete multipart generated state ' + root)
    if not isinstance(decoded, list) or len(decoded) != len(roots):
        raise ValueError('decoded variant count differs from generated states')
    if proof.get('variants') != len(roots):
        raise ValueError('variant count mismatch in ROM proof')
    pcs = {int(pc) for f in decoded for pc in f.get('pcs', [])}
    if pcs != newpcs:
        raise ValueError('ROM proof PCs do not match dispatcher entries')
    if any(f.get('entryPc') != int(routine, 16) for f in decoded):
        raise ValueError('ROM proof entry PC differs from requested routine')
    # Observation is a real CPU-state measurement. If a proof supplies its
    # E/M/X/C values, at least one decoded entry must match that state;
    # otherwise a stale/wrong-state shard may look valid by PC coverage alone.
    def matching_state(observed_state, entry_state):
        if not isinstance(entry_state, dict):
            return False
        for flag in ('emulation', 'm8', 'x8', 'carry'):
            if flag in observed_state and entry_state.get(flag) != observed_state[flag]:
                return False
        return True

    for observation in proof.get('observed', []):
        measured = observation.get('state')
        if not isinstance(measured, dict):
            continue  # Historical proofs without CPU flags remain supported.
        if not all(isinstance(measured.get(k), bool) for k in ('emulation', 'm8', 'x8', 'carry')):
            raise ValueError('ROM proof has incomplete observed CPU state')
        if not any(matching_state(measured, f.get('entryState')) for f in decoded):
            raise ValueError('ROM proof observed CPU state differs from decoded variants')
    if not any(o.get('target') == int(routine, 16) for o in proof.get('observed', [])):
        raise ValueError('ROM proof lacks an observation of the target')


def _row_state(row):
    match = re.fullmatch(
        r'\{0x([A-Fa-f0-9]+)u,(true|false),(true|false),(true|false),(true|false),(true|false),&([^,]+),0x([A-Fa-f0-9]+)u\},',
        row)
    if not match:
        raise ValueError('malformed dispatcher entry: '+row[:100])
    return tuple(match.group(i) for i in (2,3,4,5,6))


def _row_function(row):
    match = re.search(r',&(sub_([A-Fa-f0-9]{6})_[^,]+),0x', row)
    if not match:
        raise ValueError('unable to resolve existing owner for '+row)
    # A root can contain multipart functions in distinct generated_NNN.cpp files.
    # Resolve the exact dispatcher symbol, including the _partN suffix.
    return match.group(1)


def _mnemonics(source, pc):
    # Forja's ROM-based code emitter retains 65816 instruction mnemonics.
    needle = r'// \$'+f'{pc:06X}'+r'\s+([A-Z]{2,5})(?:\s|$)'
    return set(re.findall(needle, source, flags=re.M))


def _find_existing_owner_source(port, owner, owners_cache):
    """Resolve the exact function referenced by a dispatcher row.

    Generated multipart roots can be split across separate .cpp shards. Looking
    up the six-digit *root* yields multiple legitimate files and incorrectly
    rejects compatible overlays. Never choose a shard just from the root: an
    exact function definition must have one and only one owner.
    """
    if owner in owners_cache:
        return owners_cache[owner]
    definition = re.compile(r'^void\s+' + re.escape(owner) +
                            r'\(CpuState&', re.M)
    candidates = []
    for source in sorted((Path(port) / 'src').glob('*.cpp')):
        if source.name == 'dispatch.cpp':
            continue
        if definition.search(source.read_text()):
            candidates.append(source)
    if len(candidates) != 1:
        raise ValueError(f'overlap existing function {owner}: expected exactly one C++ source definition, found {len(candidates)}')
    owners_cache[owner] = candidates[0]
    return candidates[0]


def verify_overlap(port, existing_rows, generated_rows, overlap, mini_shard):
    """Reuse existing PCs only for matching CPU state and ROM instruction.

    Existing coverage stays authoritative. Only *uncovered PCs* are inserted.
    A shared PC must have every generated (E,M,X,carry) signature already
    handled, and its mnemonic must match the generated ROM source.
    """
    old_by_pc = {}
    for row in existing_rows:
        old_by_pc.setdefault(int(re.match(r'^\{0x([A-Fa-f0-9]+)u,',row)[1],16), []).append(row)
    new_by_pc = {}
    for row in generated_rows:
        new_by_pc.setdefault(int(re.match(r'^\{0x([A-Fa-f0-9]+)u,',row)[1],16), []).append(row)
    generated_source = Path(mini_shard).read_text()
    cached_sources = {}
    owners_cache = {}
    for pc in sorted(overlap):
        old_states = {_row_state(r) for r in old_by_pc[pc]}
        new_states = {_row_state(r) for r in new_by_pc[pc]}
        # The fourth state column is carry-known, and the fifth is its value.
        # An old C-unknown row owns both carry possibilities, whereas one
        # C-specific row cannot own a newly generated wildcard. Test domain
        # coverage explicitly rather than comparing their textual signatures.
        def carry_domain(state):
            return {state[4]} if state[3] == 'true' else {'false', 'true'}
        for state in new_states:
            old_covered = set()
            for existing in old_states:
                if existing[:3] == state[:3]:
                    old_covered.update(carry_domain(existing))
            if not carry_domain(state).issubset(old_covered):
                raise ValueError(f'overlap at ${pc:06X}: missing compatible CPU state; refuse merging')
        expected = _mnemonics(generated_source, pc)
        if len(expected) != 1:
            raise ValueError(f'overlap at ${pc:06X}: generated mnemonic is missing or ambiguous')
        for old_row in old_by_pc[pc]:
            owner = _row_function(old_row)
            unit = _find_existing_owner_source(port, owner, owners_cache)
            if unit not in cached_sources:
                cached_sources[unit] = unit.read_text()
            found = _mnemonics(cached_sources[unit], pc)
            if found != expected:
                raise ValueError(f'overlap at ${pc:06X}: opcode mismatch old={sorted(found)}, new={sorted(expected)}')


def verify_static_jsr_site(port, proof, routine):
    """An inferred carry domain is not a measured CPU trace.

    Accept a STATIC_JSR proof only when the ROM opcode, absolute target,
    generated caller and all advertised state candidates agree with the
    existing port. This prevents a synthetic runtime hint from masquerading
    as independent execution evidence.
    """
    static=[x for x in proof.get('observed', []) if x.get('kind')=='STATIC_JSR']
    if not static:
        return
    if len(static)!=len(proof.get('observed', [])):
        raise ValueError('cannot mix static-JSR and measured runtime evidence')
    if not all(x.get('target')==int(routine,16) for x in static):
        raise ValueError('static JSR proof target mismatch')
    callers={x.get('from') for x in static}
    if len(callers)!=1:
        raise ValueError('static JSR requires a unique caller')
    # Import by filename because the hyphenated CLI module cannot be imported normally.
    import importlib.util
    tool=Path(__file__).with_name('audit-direct-jsr.py')
    spec=importlib.util.spec_from_file_location('forja_direct_jsr',tool)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    checked=module.audit(Path(port),next(iter(callers)),int(routine,16),proof.get('mapper','hirom'))
    if proof.get('static_site_rom_sha256')!=checked['rom_sha256']:
        raise ValueError('static JSR ROM source hash mismatch')
    possible={tuple(x[k] for k in ('e','m','x','c')) for x in checked['possible_entry_states']}
    supplied=set()
    for entry in static:
        state=entry.get('state',{})
        if set(state)!={'emulation','m8','x8','carry'} or any(not isinstance(v,bool) for v in state.values()):
            raise ValueError('static JSR requires complete candidate state')
        supplied.add(tuple(int(state[k]) for k in ('emulation','m8','x8','carry')))
    if supplied != possible:
        raise ValueError('static JSR candidate states differ from caller dispatcher coverage')


def verify_static_indexed_proof(port, proof_file, routine):
    """A static table inference is not an observed replay edge.

    Verify the original ROM, the 65816 JMP (abs,X) opcode, exact pointer
    bytes, index, bank, and first target opcode before any CFG mutation.
    """
    import hashlib
    if proof_file is None:
        return
    proof=json.loads(Path(proof_file).read_text())
    rows=proof.get('observed', [])
    if not any(o.get('kind')=='STATIC_INDEXED_JMP' for o in rows):
        return
    if any(o.get('kind')!='STATIC_INDEXED_JMP' for o in rows):
        raise ValueError('mixed static/dynamic evidence is not permitted')
    spec=proof.get('static_indexed_proof')
    if not isinstance(spec,dict):
        raise ValueError('missing static indexed JMP provenance')
    raw=(Path(port)/'assets'/'cart-data.bin').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=spec.get('rom_sha256'):
        raise ValueError('static indexed JMP ROM SHA mismatch')
    try:
        site=int(spec['source'],16)
        index=int(spec['observed_x'],16)
        table_address=int(spec['table_address'],16)
        target=int(spec['target'],16)
    except (ValueError,TypeError,KeyError):
        raise ValueError('invalid static indexed JMP addresses')
    if not 0<=index<=65535 or not 0<=site<=0xffffff or not 0<=target<=0xffffff:
        raise ValueError('out of range indexed JMP witness')
    if target!=int(routine,16) or target>>16!=site>>16:
        raise ValueError('indexed JMP target/source bank mismatch')
    def get(pc):
        bank=(pc>>16)&255
        addr=pc&65535
        if bank in (0x7e,0x7f) or (addr<0x8000 and not (0x40<=bank<=0x7d or bank>=0xc0)):
            raise ValueError('static JMP accesses unmapped HiROM')
        offset=((bank&63)<<16)|addr
        if offset>=len(raw):raise ValueError('ROM offset out of range')
        return raw[offset]
    if get(site)!=0x7c:
        raise ValueError('static source opcode is not indexed indirect JMP')
    base=get((site&0xff0000)|((site+1)&65535))|(get((site&0xff0000)|((site+2)&65535))<<8)
    at=(site&0xff0000)|((base+index)&65535)
    dest=(site&0xff0000)|(get(at)|(get((site&0xff0000)|((at+1)&65535))<<8))
    if at!=table_address or dest!=target:
        raise ValueError('ROM table destination differs from static proof')
    if not rows or any(o.get('target')!=target or o.get('from')!=site for o in rows):
        raise ValueError('static CFG entry lacks source+target linkage')


def verify_direct_jsl_proof(port, proof_file, routine):
    """Independently recheck an optional direct-JSL witness during port merge.

    Reject a replaced JSON after generation. Requires the observed caller to
    have dispatcher coverage and refuses a different ROM, instruction or state.
    """
    if proof_file is None:
        return
    import hashlib
    proof = json.loads(Path(proof_file).read_text())
    witness = proof.get('direct_jsl_trace_crosscheck')
    if witness is None:
        return
    try:
        src, dest = int(witness['source']), int(witness['target'])
        state = witness['state']
    except (ValueError, TypeError, KeyError):
        raise ValueError('Invalid direct-JSL provenance')
    raw = (Path(port)/'assets'/'cart-data.bin').read_bytes()
    if dest != int(routine, 16) or witness.get('kind') != 'JSL_ABSOLUTE_LONG' or \
       witness.get('rom_sha256') != hashlib.sha256(raw).hexdigest() or \
       not isinstance(state, dict) or set(state) != {'e','m','x','c'} or \
       any(type(v) is not int or v not in (0,1) for v in state.values()):
        raise ValueError('Direct-JSL witness ROM, target or CPU flags mismatch')
    if not 0x800000 <= src <= 0xffffff or (src&65535)>65531:
        raise ValueError('Direct-JSL source is not a ROM instruction')
    offset = src & 0x3fffff
    if offset+4 > len(raw) or raw[offset]!=0x22 or \
       raw[offset+1] | raw[offset+2]<<8 | raw[offset+3]<<16 != dest:
        raise ValueError('Direct-JSL edge differs from current ROM')
    observed = proof.get('observed',[])
    def matches(o):
        st=o.get('state') or {}
        return o.get('kind')=='FLOW' and o.get('from')==src and o.get('target')==dest and \
          all(st.get(k)==bool(state[n]) for k,n in [('emulation','e'),('m8','m'),('x8','x'),('carry','c')])
    if not any(matches(o) for o in observed):
        raise ValueError('Direct-JSL witness has no matching runtime state')
    dispatch = (Path(port)/'src'/'dispatch.cpp').read_text()
    if not re.search(r'^\{0x'+f'{src:06X}'+r'u,', dispatch, re.M):
        raise ValueError('Direct-JSL caller lacks dispatcher coverage')


def merge(port, mini_dispatch, mini_shard, routine, proof_file=None, expected_rom=None, allow_verified_overlap=False, guarded_stack_return=False):
    routine=routine.upper().replace('0X','').replace(':','')
    if not re.fullmatch('[A-F0-9]{6}',routine):raise ValueError('routine must be 24-bit SNES address')
    base=Path(port);source=base/'src'/'dispatch.cpp';cmake=base/'CMakeLists.txt'
    old=source.read_text(); new=Path(mini_dispatch).read_text(); shard=Path(mini_shard).read_text()
    funcs=code_functions(shard,routine)
    aliases=get_array(old,'Forja65AliasEntry'); mini_aliases=get_array(new,'Forja65AliasEntry')
    dispatch=get_array(old,'Forja65DispatchEntry'); mini_dispatches=get_array(new,'Forja65DispatchEntry')
    newrows=[line for line in mini_dispatches.group(2).splitlines() if '&sub_'+routine+'_' in line]
    if not newrows or len(newrows)<len(funcs): raise ValueError('no dispatch entries for observed routine')
    key=lambda s:int(re.match(r'^\{0x([A-Fa-f0-9]+)u,',s)[1],16)
    oldrows=[l for l in dispatch.group(2).splitlines() if l.startswith('{')]
    oldpcs={key(l) for l in oldrows}; newpcs={key(l) for l in newrows}
    overlap = oldpcs & newpcs
    if overlap and not allow_verified_overlap:
        raise ValueError('existing dispatcher already covers some observed PCs: '+','.join(hex(x) for x in sorted(overlap)[:8]))
    if int(routine,16) in oldpcs:
        raise ValueError('observed entry PC already belongs to existing dispatcher')
    if int(routine,16) not in newpcs:raise ValueError('observed entry address absent')
    if proof_file is None:
        sibling = Path(mini_shard).with_name('proof.json')
        if sibling.is_file(): proof_file = sibling
    if overlap and allow_verified_overlap and (proof_file is None or expected_rom is None):
        raise ValueError('verified overlap requires ROM proof and expected fingerprint')
    validate_proof(proof_file, routine, funcs, newpcs, expected_rom)
    verify_static_indexed_proof(base, proof_file, routine)
    verify_direct_jsl_proof(base, proof_file, routine)
    if proof_file is not None:
        verify_static_jsr_site(base, json.loads(Path(proof_file).read_text()), routine)
    if overlap:
        verify_overlap(base, oldrows, newrows, overlap, mini_shard)
        # Preserve the original dispatch ownership of overlapping PCs.
        newrows = [line for line in newrows if key(line) not in overlap]
        if not newrows:
            raise ValueError('all generated PCs are already covered')
    addedpcs = newpcs - oldpcs
    # Physical ROM alias is shared with mirrored banks; copy only actually new targets.
    alias_re=re.compile(r'^\{0x([A-Fa-f0-9]+)u,0x([A-Fa-f0-9]+)u\},$')
    oldaliases=[l for l in aliases.group(2).splitlines() if l.startswith('{')]
    newaliases=[l for l in mini_aliases.group(2).splitlines() if l.startswith('{') and int(alias_re.match(l)[2],16) in newpcs]
    addedaliases=[l for l in newaliases if l not in oldaliases]
    def alias_key(l):
        m=alias_re.match(l)
        if m is None: raise ValueError('malformed alias row '+l)
        return (int(m[1],16),int(m[2],16))
    mergedaliases=sorted(set(oldaliases+addedaliases),key=alias_key)
    # C++ dispatch lookup requires ascending PC. Keep order of variants at equal PC.
    mergedrows=sorted(oldrows+newrows,key=key)
    newtext=old[:aliases.start(2)]+'\n'.join(mergedaliases)+old[aliases.end(2):]
    dispatch2=get_array(newtext,'Forja65DispatchEntry')
    newtext=newtext[:dispatch2.start(2)]+'\n'.join(mergedrows)+newtext[dispatch2.end(2):]
    # Restore only ROM-confirmed STACK return destinations to the whitelist,
    # never authorize arbitrary return addresses (especially WRAM or IO).
    new_stack_targets=0
    if guarded_stack_return:
        if proof_file is None or expected_rom is None:
            raise ValueError('guarded return needs ROM-bound proof and exact hash')
        proof_check=json.loads(Path(proof_file).read_text())
        observed=proof_check.get('observed',[])
        if not observed or any(o.get('kind')!='STACK-RTL' or o.get('target')!=int(routine,16)
                              for o in observed):
            raise ValueError('guarded return only supports proven STACK-RTL observations')
        # Require explicit runtime-side provenance guard. Merely having a ROM
        # address in the dispatch table is never enough for a computed RTL.
        runtime=(base/'src'/'runtime.hpp').read_text()
        if 'consumeTableConstructedLongReturn' not in runtime:
            raise ValueError('guarded return needs explicit runtime provenance validation')
        source_pc=observed[0].get('from')
        if source_pc is None or any(o.get('from')!=source_pc for o in observed):
            raise ValueError('guarded returns need a single observed RTL site')
        guard_signature='consumeTableConstructedLongReturn(dst,cpu)'
        if not any(guard_signature in f.read_text() and f'0x{source_pc:06X}u' in f.read_text()
                   for f in (base/'src').glob('generated_*.cpp')):
            raise ValueError('guarded return has no native RTL-site check')
    if proof_file is not None:
        proof=json.loads(Path(proof_file).read_text())
        stack_observations=[o for o in proof.get('observed', []) if o.get('kind') in ('STACK-RTL','STACK-RTS') and o.get('target')==int(routine,16)]
        if stack_observations and not guarded_stack_return:
            if not expected_rom or proof.get('rom') != expected_rom or proof.get('verifiedStackReturns',0) < 1:
                raise ValueError('stack destination lacks ROM fingerprint and verified runtime-return evidence')
            offsets={int(m.group(2),16):int(m.group(1),16) for l in newaliases
                if (m := alias_re.match(l))}
            offset=offsets.get(int(routine,16))
            if offset is None:raise ValueError('stack return target missing ROM alias')
            marker=re.search(r'(static const std::uint32_t kForja65StackReturnOffsets\[\]=\{)([^}]*)(\};)',newtext)
            if marker is None:raise ValueError('stack return whitelist not found in existing project')
            values={int(q,16) for q in re.findall(r'0x([a-fA-F0-9]+)u',marker.group(2))}
            if offset not in values:
                values.add(offset);new_stack_targets=1
                text=','.join(f'0x{q:06X}u' for q in sorted(values))
                newtext=newtext[:marker.start(2)]+text+newtext[marker.end(2):]
    declarations=[]
    for fname,_ in funcs:
        decl=re.search(r'^void '+re.escape(fname)+r'\([^\n]+;',new,re.M)
        if not decl:raise ValueError('missing declaration for '+fname)
        if fname in old: raise ValueError('already declared '+fname)
        declarations.append(decl.group(0))
    pos=newtext.index('struct Forja65AliasEntry')
    newtext=newtext[:pos]+'\n'.join(declarations)+'\n'+newtext[pos:]
    # Preserve other program units; add only one new implementation file.
    target='src/forja_'+routine.lower()+'.cpp'
    unit=base/target
    if unit.exists():raise ValueError('target generated unit already exists')
    cmaketext=cmake.read_text()
    anchor='add_library(forja65_generated OBJECT '
    start=cmaketext.index(anchor)+len(anchor)
    end=cmaketext.index(')',start)
    cmaketext=cmaketext[:end]+' '+target+cmaketext[end:]
    unit.write_text('#include "generated.hpp"\n'+'\n\n'.join(body for _,body in funcs)+'\n')
    source.write_text(newtext)
    cmake.write_text(cmaketext)
    return {'routine':routine,'functions':len(funcs),'new_entry_pcs':len(addedpcs),'verified_existing_pcs':len(overlap),'new_dispatch_rows':len(newrows),'new_alias_rows':len(addedaliases),'new_stack_targets':new_stack_targets,'source':target}


def main():
    p=argparse.ArgumentParser();p.add_argument('--port',required=True);p.add_argument('--mini-dispatch',required=True);p.add_argument('--mini-shard',required=True);p.add_argument('--routine',required=True)
    p.add_argument('--proof',help='explicit proof.json path (required for strict verification)');p.add_argument('--expected-rom',help='16-hex Forja65 ROM fingerprint')
    p.add_argument('--guarded-stack-return',action='store_true',help='require an explicit native provenance guard; do not add broad RTL whitelist entry')
    p.add_argument('--allow-verified-overlap',action='store_true',help='reuse existing PCs only after ROM proof, opcode and CPU-state checks')
    a=p.parse_args();print(merge(a.port,a.mini_dispatch,a.mini_shard,a.routine,a.proof,a.expected_rom,a.allow_verified_overlap,a.guarded_stack_return))
if __name__=='__main__':main()
