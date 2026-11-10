#!/usr/bin/env python3
"""Safely add a ROM-generated Forja65 routine to an existing port.

Requires a prior successful tools/verify-generated-rom.js run. This performs
structural checks, not semantic equivalence. Never silently replaces existing
routines or claims the game is playable.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROW = re.compile(r'^\{0x([A-F0-9]{6})u,([^\n]+)\},$')
DISPATCH_MARKER = re.compile(r'(static const(?:expr)?\s+Forja65DispatchEntry\s+kForja65Dispatch\[\]\s*=\s*\{)')


def state_domains_overlap(first: str, second: str) -> bool:
    def domain(row):
        fields=ROW.fullmatch(row)[2].split(',')[:5]
        if len(fields)!=5 or any(v not in ('true','false') for v in fields):
            raise ValueError('Unsupported dispatcher state fields')
        e,m,x,known,c=(v=='true' for v in fields)
        return e,m,x,({c} if known else {False,True})
    a,b=domain(first),domain(second)
    return a[:3]==b[:3] and bool(a[3]&b[3])



ALIAS_HEADER = re.compile(r'(static const Forja65AliasEntry kForja65Aliases\[\]\s*=\s*\{\n)')
ALIAS_ROW = re.compile(r'^\{0x([A-F0-9]{6})u,0x([A-F0-9]{6})u\},$')


def merge_rom_aliases(existing_dispatch: str, generated_dispatch: str, new_pcs: set[int]):
    """Import ROM-offset aliases alongside dispatch rows, not only C++ handlers.

    The runtime's restricted RTL/RTS acceptance checks the *physical* ROM-offset
    alias list before consulting its preexisting return allowlist. Without
    aliases, a verified and compiled return target still looks unresolved.
    Keep previous offsets/owners intact. Never fabricate an alias from a PC.
    """
    def read(text):
        match = ALIAS_HEADER.search(text)
        if not match:
            raise ValueError('Missing ROM alias table in dispatcher')
        end = text.find('\n};',match.end())
        if end < 0:
            raise ValueError('Unterminated ROM alias table')
        rows = text[match.end():end].splitlines()
        decoded = []
        for row in rows:
            found = ALIAS_ROW.fullmatch(row)
            if not found:
                raise ValueError('Malformed ROM alias entry')
            decoded.append((int(found[1], 16),int(found[2],16)))
        if decoded != sorted(decoded):
            raise ValueError('Unsorted ROM alias table')
        return match,end,decoded
    match,end,old = read(existing_dispatch)
    _,_,candidates = read(generated_dispatch)
    old_off = {off for off,pc in old}
    selected = [(off,pc) for off,pc in candidates if pc in new_pcs and off not in old_off]
    # Each ROM offset should have at most one owner, even if the generator
    # emitted multiple mirrors. Reject contradictions rather than shadowing.
    new_offsets = {}
    for off,pc in selected:
        if off in new_offsets and new_offsets[off] != pc:
            raise ValueError('Conflicting ROM alias owner')
        new_offsets[off] = pc
    if not new_offsets:
        return existing_dispatch, 0
    merged = sorted(old+sorted(new_offsets.items()))
    lines = ''.join(f'{{0x{off:06X}u,0x{pc:06X}u}},\n' for off,pc in merged)
    return existing_dispatch[:match.end()]+lines.rstrip('\n')+existing_dispatch[end:],len(new_offsets)


def integrate(project: Path, generated: Path, entry: str, proof: Path, *, commit: bool, preserve_existing: bool=False, missing_states: bool=False, source_unit: str | None=None):
    entry = entry.upper().removeprefix('0X')
    if not re.fullmatch(r'[0-9A-F]{6}', entry):
        raise ValueError('Entry must be six hexadecimal digits')
    # State-only imports at the same PC must live in a separate source unit.
    # Validate the suffix before constructing paths or mutating anything.
    if source_unit is not None and not re.fullmatch(r'[a-z0-9][a-z0-9_]{0,39}', source_unit):
        raise ValueError('Unsafe source unit: only lowercase ASCII letters, digits and underscore are allowed')
    source_name = f'forja_{entry.lower()}' + (f'_{source_unit}' if source_unit else '') + '.cpp'
    info = json.loads(proof.read_text(encoding='utf-8'))
    sources = sorted(p for p in generated.glob('src/generated_*.cpp')
                     if f'void sub_{entry}_' in p.read_text(encoding='utf-8'))
    if not sources:
        raise ValueError(f'Generated routine {entry} not found')
    # A generated handler can be split into independent C++ function shards.
    # Never import only the first shard: dispatch entries can target every part.
    shard_text = [p.read_text(encoding='utf-8') for p in sources]
    generated_cpp = '\n'.join(shard_text) if len(sources) > 1 else shard_text[0]
    proof_shards = info.get('source_shards')
    if len(sources) > 1:
        expected = [{'name': p.name, 'sha256': hashlib.sha256(data.encode()).hexdigest()}
                    for p, data in zip(sources, shard_text)]
        if proof_shards != expected:
            raise ValueError('Multi-shard ROM proof must authenticate every handler shard')
    elif proof_shards:
        expected = [{'name': sources[0].name, 'sha256': hashlib.sha256(shard_text[0].encode()).hexdigest()}]
        if proof_shards != expected:
            raise ValueError('Source shard provenance mismatch')
    # A focused Forja65 analysis may emit extra CFG functions reached while
    # exploring the observed target. Importing these functions blindly creates
    # duplicate global definitions (e.g. BB8D90 from B9E124). They are not
    # owned by this integration. Keep only the requested target's bodies.
    original_generated_cpp = generated_cpp
    chosen = []
    ignored_functions = []
    for data in shard_text:
        fns = list(re.finditer(r'^void (sub_[A-F0-9]{6}_[A-Za-z0-9_]+)\(CpuState&',data,re.M))
        if not fns or data[:fns[0].start()].strip() != '#include "generated.hpp"':
            raise ValueError('Unexpected generated source preamble')
        for ix,fn in enumerate(fns):
            end = fns[ix+1].start() if ix+1 < len(fns) else len(data)
            if fn.group(1).startswith('sub_'+entry+'_'):
                chosen.append(data[fn.start():end])
            else:
                ignored_functions.append(fn.group(1))
    if not chosen:
        raise ValueError('Focused source does not define its observed entry')
    generated_cpp = '#include "generated.hpp"\n' + ''.join(chosen)
    if len(sources)>1:
        # Every part must be independently resumable from all of its labels.
        for body in chosen:
            cases = set(re.findall(r'case 0x([0-9A-F]{6})u: goto L_([0-9A-F]{6});',body))
            if not cases or any(a!=b for a,b in cases):
                raise ValueError('Malformed split-handler entry dispatch')
            labels=set(re.findall(r'^L_([0-9A-F]{6}):',body,re.M))
            if {a for a,b in cases}!=labels:
                raise ValueError('Incomplete split-handler labels')
    if (info.get('entry') != entry or info.get('rom_opcode_mismatches') != 0
            or info.get('code_sha256') != hashlib.sha256(original_generated_cpp.encode()).hexdigest()):
        raise ValueError('Generated source and ROM provenance report do not match')
    rompath = project / 'assets/cart-data.bin'
    if not rompath.is_file():
        raise ValueError('Project ROM assets/cart-data.bin missing')
    rombytes = rompath.read_bytes()
    if hashlib.sha256(rombytes).hexdigest() != info['rom']['sha256']:
        raise ValueError('ROM mismatch: refusing to integrate generated code')
    declarations = re.findall(r'^void (sub_'+entry+r'_[A-Za-z0-9_]+)\(CpuState&', generated_cpp, re.M)
    if not declarations or len(set(declarations)) != len(declarations):
        raise ValueError('Missing or duplicated routine declarations')
    # A repeated import is rejected before scanning other C++ definitions;
    # distinguish it from a collision with an unrelated generated shard.
    if (project / 'src' / source_name).exists():
        raise ValueError('Routine already integrated: refusing duplicate insertion')
    # Dispatch ownership alone is insufficient: a previously generated shard
    # might define a function not currently exposed in the dispatcher. Catch
    # that duplicate at integration time rather than at the final link stage.
    for sibling in (project/'src').glob('*.cpp'):
        if sibling.name == 'dispatch.cpp':  # declarations, not definitions
            continue
        existing = sibling.read_text(encoding='utf-8')
        for function in declarations:
            if re.search(r'^void '+re.escape(function)+r'\(CpuState&', existing, re.M):
                raise ValueError(f'Function {function} already defined in {sibling.name}')
    generated_dispatch = (generated/'src/dispatch.cpp').read_text(encoding='utf-8')
    entries = [line for line in generated_dispatch.splitlines()
               if ROW.fullmatch(line) and any('&'+decl+',' in line for decl in declarations)]
    if set(declarations) != {name for name in declarations if any('&'+name+',' in line for line in entries)}:
        raise ValueError('Split-handler part not exposed in generated dispatch')
    if not entries or f'{{0x{entry}u,' not in '\n'.join(entries):
        raise ValueError('No dispatcher entries for generated routine')
    pcs = [int(ROW.fullmatch(row)[1], 16) for row in entries]
    if pcs != sorted(pcs):
        raise ValueError('Generated dispatch rows out of order')
    target_dispatch = project / 'src/dispatch.cpp'
    target_cpp = project / 'src' / source_name
    target_cmake = project / 'CMakeLists.txt'
    if target_cpp.exists() or any(decl in target_dispatch.read_text(encoding='utf-8') for decl in declarations):
        raise ValueError('Routine already integrated: refusing duplicate insertion')
    original = target_dispatch.read_text(encoding='utf-8')
    match = DISPATCH_MARKER.search(original)
    if not match:
        raise ValueError('Target dispatcher table not found')
    start = original.index('\n', match.end()) + 1
    end = original.index('\n};', start)
    old_rows = original[start:end].splitlines(keepends=True)
    old_pcs = [int(m[1], 16) for row in old_rows if (m := ROW.fullmatch(row.rstrip('\n')))]
    if old_pcs != sorted(old_pcs):
        raise ValueError('Existing dispatcher table not ordered')
    overlap = set(old_pcs) & set(pcs)
    if overlap and not (preserve_existing or missing_states):
        raise ValueError('Existing dispatch address conflicts: '+', '.join(f'{p:06X}' for p in sorted(overlap)[:8]))
    # The same instruction site can be independently discovered from multiple
    # ROM entry points. Preserve the already-tested dispatcher ownership;
    # only the previously unowned sites may be added. The full generated body
    # remains available for in-function branches, but never replaces an entry.
    if overlap and missing_states:
        by_pc={}
        for row in old_rows:
            clean=row.rstrip('\n'); match_row=ROW.fullmatch(clean)
            if match_row:by_pc.setdefault(int(match_row[1],16),[]).append(clean)
        entries=[row for row in entries if not any(state_domains_overlap(row,old) for old in by_pc.get(int(ROW.fullmatch(row)[1],16),[]))]
        pcs=[int(ROW.fullmatch(row)[1],16) for row in entries]
        if int(entry,16) not in pcs:
            raise ValueError('Observed entry state is already owned; no uncovered root remains')
    elif overlap:
        # Preserving old ownership is safe only when every overlapping ROM PC
        # has compatible E/M/X/carry coverage and exactly the same opcode.
        # Reuse the strict verification already exercised by the observed-flow
        # integrator; silently dropping conflicting rows can hide CPU bugs.
        import importlib.util
        strict_path = Path(__file__).with_name('integrate-observed-flow.py')
        spec = importlib.util.spec_from_file_location('forja65_strict_overlap', strict_path)
        strict = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(strict)
        # Overlapping instructions can reside in any generated shard. Verify
        # against the complete, authenticated imported body, not just shard 0.
        import tempfile
        with tempfile.TemporaryDirectory(prefix='forja65-overlap-') as tmp:
            complete_unit = Path(tmp) / 'candidate.cpp'
            complete_unit.write_text(generated_cpp, encoding='utf-8')
            strict.verify_overlap(project,
                                  [r.rstrip('\n') for r in old_rows if ROW.fullmatch(r.rstrip('\n'))],
                                  entries, overlap, complete_unit)
        if int(entry, 16) in overlap:
            raise ValueError('Observed entry is already owned: refusing to shadow its dispatcher')
        entries = [row for row in entries if int(ROW.fullmatch(row)[1], 16) not in overlap]
        pcs = [int(ROW.fullmatch(row)[1], 16) for row in entries]
        if not entries or int(entry,16) not in pcs:
            raise ValueError('No new observed target entries remain after preserving ownership')

    if 'src/dispatch.cpp' not in target_cmake.read_text(encoding='utf-8'):
        raise ValueError('No src/dispatch.cpp in CMakeLists.txt')
    merged = []
    i = 0
    for row in old_rows:
        m = ROW.fullmatch(row.rstrip('\n'))
        if m:
            pc = int(m[1], 16)
            while i < len(entries) and (pcs[i] < pc or (missing_states and pcs[i] == pc)):
                merged.append(entries[i]+'\n')
                i += 1
        merged.append(row)
    merged.extend(row+'\n' for row in entries[i:])
    declaration_block = '\n'.join(f'void {fn}(CpuState&, SnesRuntime&, std::uint32_t);' for fn in declarations)+'\n'
    new_dispatch = original[:start] + ''.join(merged) + original[end:]
    # Declarations must be visible before the dispatch table; no downstream header edits.
    marker = match.group(0)
    assert new_dispatch.count(marker) == 1
    new_dispatch = new_dispatch.replace(marker, declaration_block+marker, 1)
    new_dispatch, added_aliases = merge_rom_aliases(new_dispatch, generated_dispatch, set(pcs) - set(old_pcs))
    cmake = target_cmake.read_text(encoding='utf-8')
    if f'src/{source_name}' in cmake:
        raise ValueError('Generated source already listed in CMake')
    new_cmake = cmake.replace('src/dispatch.cpp', f'src/dispatch.cpp src/{source_name}', 1)
    merged_pcs = [int(m[1],16) for r in merged if (m:=ROW.fullmatch(r.rstrip('\n')))]
    if merged_pcs != sorted(merged_pcs) or len(merged_pcs)!=len(old_pcs)+len(entries):
        raise ValueError('Dispatcher merge structural verification failed')
    summary = {'source_file':'src/'+source_name,'source_shards':[p.name for p in sources], 'shard_count':len(sources), 'entry':entry,'rom_sha256':info['rom']['sha256'], 'generated_cpp_sha256':info['code_sha256'],
               'variants':declarations,'ignored_non_target_functions':ignored_functions,
               'integrated_source_sha256':hashlib.sha256(generated_cpp.encode()).hexdigest(),
               'added_rom_aliases':added_aliases,
               'new_dispatch_rows':len(entries),'new_instruction_sites':len(set(pcs)-set(old_pcs)),
               'imported_instruction_sites':len(set(pcs)),
               'new_state_sites':len(set(pcs)&set(old_pcs)),
               'missing_states_mode':missing_states,'state_domain_overlap':0,
               'address_overlap':len(set(pcs)&set(old_pcs)),'preserved_existing_sites':len(overlap),
               'preserved_existing_rows':sum(1 for pc in old_pcs if pc in overlap),
               'new_dispatch_owner_sites':len(set(pcs)-set(old_pcs)),
               'previous_dispatch_rows':len(old_pcs),
               'proof_level':'ROM opcode match and static dispatch integration only; runtime replay required',
               'dry_run':not commit}
    if commit:
        # All checks above must pass before writing any source file.
        target_cpp.write_text(generated_cpp, encoding='utf-8')
        target_dispatch.write_text(new_dispatch, encoding='utf-8')
        target_cmake.write_text(new_cmake, encoding='utf-8')
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--generated', type=Path, required=True)
    parser.add_argument('--entry', required=True)
    parser.add_argument('--proof', type=Path, required=True)
    parser.add_argument('--apply', action='store_true', help='Actually write changes; default is validation-only')
    parser.add_argument('--preserve-existing', action='store_true', help='Keep existing dispatcher ownership for shared instruction sites (never overwrite the observed entry)')
    parser.add_argument('--missing-states', action='store_true', help='Add only disjoint state domains at shared PCs')
    parser.add_argument('--source-unit', help='Safe source suffix for an additional M/X/C state variant')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = integrate(args.project, args.generated, args.entry, args.proof, commit=args.apply, preserve_existing=args.preserve_existing, missing_states=args.missing_states, source_unit=args.source_unit)
    if args.report:
        args.report.write_text(json.dumps(result, indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
