#!/usr/bin/env python3
"""REV200 - CPU AOT route gate. Never certifies an unexecuted route.

inspect: ROM/CFG proof of *direct* JSR/JSL returns observed by REV199.
run: baseline logical replay -> proofs -> CMake rebuild -> AOT logical replay ->
     differential comparison and no-interpreter evidence.

This intentionally never auto-authorizes JSR (abs,X), stack-constructed or
ambiguous returns. These require separately proven control-flow evidence.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

RETURNS = re.compile(r'(static const std::uint32_t kForja65StackReturnOffsets\[\]=\{)([^}]*)(\};)')
HEX = re.compile(r'0x([0-9a-fA-F]{6,8})u')
ALIAS = re.compile(r'\{0x([0-9a-fA-F]{6})u,0x([0-9a-fA-F]{6})u\}')
DISPATCH = re.compile(r'\{0x([0-9a-fA-F]{6})u,(?:true|false),')
RETURN_LINE = re.compile(r'^[0-9a-fA-F]{6}$')
HASH_LINE = re.compile(r'^frame=(\d+)\s+framebuffer=([0-9a-fA-F]+)\s+wram=([0-9a-fA-F]+)\s+pc=([0-9a-fA-F]+)$')
MAX_OBSERVED = 100000


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def json_out(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def read_logic(path: Path) -> int:
    if not path.is_file():
        raise ValueError(f'missing logic trace: {path}')
    count = 0
    header = False
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.startswith('# FORJA65_LOGIC_TRACE 1'):
            header = True
        if line.startswith('#') or not line.strip():
            continue
        for tok in line.split():
            m = re.fullmatch(r'([0-9a-fA-F]{1,4})(?:\*(\d+))?', tok)
            if not m:
                raise ValueError(f'invalid logical replay token: {tok}')
            n = int(m[2]) if m[2] is not None else 1
            if n < 1 or n > 1000000 or count + n > 5000000:
                raise ValueError('invalid or excessive logic replay length')
            count += n
    if not header or not count:
        raise ValueError('missing logical replay header or inputs')
    return count


def observe(path: Path) -> list[int]:
    if not path.exists():
        raise ValueError(f'observer output absent: {path}')
    found = set()
    for line in path.read_text(encoding='utf-8').splitlines():
        v = line.strip()
        if not RETURN_LINE.fullmatch(v):
            raise ValueError(f'invalid observed return: {v[:90]}')
        found.add(int(v, 16))
        if len(found) > MAX_OBSERVED:
            raise ValueError('observed return limit exceeded')
    return sorted(found)


def parse_dispatch(text: str):
    array = RETURNS.findall(text)
    if len(array) != 1:
        raise ValueError('missing or duplicate return-offset table')
    values = [int(x, 16) for x in HEX.findall(array[0][1])]
    valid_values = [v for v in values if v != 0xffffffff]
    if valid_values != sorted(set(valid_values)):
        raise ValueError('unsorted/duplicated return table')
    amarker = 'static const Forja65AliasEntry kForja65Aliases[]={'
    start = text.find(amarker)
    stop = text.find('};', start)
    if start < 0 or stop < 0:
        raise ValueError('missing canonical physical ROM alias array')
    pairs = [(int(a, 16), int(b, 16)) for a, b in ALIAS.findall(text[start:stop])]
    if not pairs or pairs != sorted(pairs):
        raise ValueError('invalid canonical ROM aliases')
    rom_offsets = {}
    for off, pc in pairs:
        rom_offsets.setdefault(pc, set()).add(off)
    physical = {}
    for off, pc in pairs:
        physical.setdefault(off, set()).add(pc)
    dstart = text.find('static const Forja65DispatchEntry kForja65Dispatch[]=')
    dend = text.find('};', dstart)
    if dstart < 0 or dend < 0:
        raise ValueError('missing compiled dispatcher entries')
    entries = {int(p, 16) for p in DISPATCH.findall(text[dstart:dend])}
    if not entries:
        raise ValueError('empty compiled dispatcher')
    return array[0], valid_values, rom_offsets, physical, entries


def prove_returns(project: Path, observed: list[int], apply: bool = False) -> dict:
    project = project.resolve()
    rom = project / 'assets' / 'cart-data.bin'
    dispatch = project / 'src' / 'dispatch.cpp'
    if not rom.is_file() or not dispatch.is_file():
        raise ValueError('generated project must contain assets/cart-data.bin and src/dispatch.cpp')
    data = rom.read_bytes()
    source = dispatch.read_text(encoding='utf-8')
    arr, authorized, by_pc, by_off, entries = parse_dispatch(source)
    # Generation/CFG proof: callsite must be a translated C++ instruction.
    # Search source comments emitted by generateFunction; collect *only* direct calls.
    callsites: dict[int, set[str]] = {}
    comment = re.compile(r'//\s*\$([0-9A-Fa-f]{6})\s+(JSR|JSL)\b')
    for unit in sorted((project/'src').glob('generated_*.cpp')):
        for pc, opcode in comment.findall(unit.read_text(encoding='utf-8')):
            callsites.setdefault(int(pc, 16), set()).add(opcode)
    rows = []
    additions = set()
    for target in observed:
        mapped = by_pc.get(target, set())
        result = {'target': f'{target:06X}', 'status': 'needs_cfg', 'proof': None}
        if not mapped or target not in entries:
            result['reason'] = 'return target has no compiled dispatcher state/alias'
            rows.append(result);continue
        if len(mapped) != 1:
            result['reason'] = 'return target has ambiguous physical ROM aliases'
            rows.append(result);continue
        ret_off = next(iter(mapped))
        if ret_off >= len(data):
            result['reason'] = 'return offset outside ROM'
            rows.append(result);continue
        if ret_off in authorized:
            result.update(status='already_authorized', rom_offset=f'{ret_off:06X}')
            rows.append(result);continue
        candidates = []
        for length, mnemonic, opcode in ((3, 'JSR', 0x20), (4, 'JSL', 0x22)):
            # 65C816 short JSR stays in the bank; JSL has a 24-bit return.
            # A PC+length offset crossing the 64K boundary cannot be inferred.
            if (target & 0xffff) < length:
                continue
            src_pc = target - length
            for src_off in by_pc.get(src_pc, set()):
                if src_off >= len(data) or data[src_off] != opcode:
                    continue
                if src_pc not in entries or mnemonic not in callsites.get(src_pc, set()):
                    continue
                if mnemonic == 'JSR' and src_pc >> 16 != target >> 16:
                    continue
                if src_off + length > len(data):
                    continue
                candidates.append({'callsite': f'{src_pc:06X}', 'opcode': mnemonic,
                                   'callsite_rom_offset': f'{src_off:06X}'})
        if len(candidates) == 1:
            result.update(status='verified_direct_call', proof=candidates[0], rom_offset=f'{ret_off:06X}')
            additions.add(ret_off)
        else:
            result['reason'] = 'no unique translated ROM-backed direct JSR/JSL callsite; indirect/stack returns need separate CFG proof'
            result['candidates'] = candidates
        rows.append(result)
    if apply and additions:
        # Do not synthesize aliases: only authorize returns already present in
        # the verified compiled dispatcher. Avoid authorizing mere ROM data.
        old = ''.join(arr)
        replacement = arr[0] + ','.join(f'0x{x:06X}u' for x in sorted(set(authorized)|additions)) + arr[2]
        if source.count(old) != 1:
            raise ValueError('non-unique return table, refusing modification')
        dispatch.write_text(source.replace(old, replacement, 1), encoding='utf-8')
    return {'schema': 'forja65.rev200.returns.v1', 'project': str(project),
            'rom_sha256': sha(rom), 'dispatch_sha256_after': sha(dispatch),
            'observed_count': len(observed), 'already_authorized': sum(x['status']=='already_authorized' for x in rows),
            'direct_verified': len(additions), 'unproven_count': sum(x['status']=='needs_cfg' for x in rows),
            'applied': bool(apply), 'verified_offsets': [f'{x:06X}' for x in sorted(additions)],
            'candidates': rows, 'unproven_are_not_authorized': True}


def upgrade_runtime(project: Path, apply: bool = False) -> dict:
    """Upgrade a REV199 port in place without regenerating its CFG/shards."""
    target = project.resolve()/'src'/'runtime.hpp'
    if not target.is_file():
        raise ValueError('missing generated src/runtime.hpp')
    raw = target.read_text(encoding='utf-8')
    before = sha(target)
    if 'FORJA65_LOGIC_DIGEST_OUT' in raw and 'logicDigestRecord();' in raw:
        return {'status':'already_current', 'applied':False,'runtime_sha256':before}
    insertion = '''  // REV200: hash video and WRAM aligned with each logical input.
  std::FILE* logicDigestFile{}; bool logicDigestInit{};
  void logicDigestRecord(){
    if(!logicDigestInit){logicDigestInit=true;const char*p=std::getenv("FORJA65_LOGIC_DIGEST_OUT");
      if(p&&*p)logicDigestFile=std::fopen(p,"wb");}
    if(!logicDigestFile)return;
    std::uint8_t rec[24]{};const std::uint32_t f=(std::uint32_t)frameCounter,k=(std::uint32_t)logicPos;
    const std::uint64_t video=framebufferHash(),memory=ramHash();
    std::memcpy(rec,&f,4);std::memcpy(rec+4,&k,4);
    std::memcpy(rec+8,&video,8);std::memcpy(rec+16,&memory,8);
    std::fwrite(rec,1,sizeof rec,logicDigestFile);
  }
'''
    marker = '  void logicReplayAtVblank(){'
    invoke = 'logicPos++;logicStateRecord();'
    if raw.count(marker)!=1 or raw.count(invoke)!=1 or 'FORJA65_LOGIC_STATE_OUT' not in raw:
        raise ValueError('not compatible with REV199 logical runtime; regenerate the port')
    changed = raw.replace(marker,insertion+marker,1).replace(invoke,invoke+'logicDigestRecord();',1)
    if apply:
        target.write_text(changed,encoding='utf-8')
    return {'status':'upgraded' if apply else 'upgrade_required',
            'applied':apply,'runtime_sha256_before':before,
            'runtime_sha256_after':sha(target) if apply else hashlib.sha256(changed.encode()).hexdigest()}


def assert_no_cross_run_env(environ):
    # Fully isolate IO/control/checkpoints across runs. Preserve explicit
    # hardware timing profiles equally in both modes.
    prefixes = ('FORJA65_CHECKPOINT_', 'FORJA65_CONTROL_', 'FORJA65_FRAME_PROGRESS_')
    removed = ('FORJA65_INPUT_REPLAY', 'FORJA65_INPUT_RECORD', 'FORJA65_CONTROL',
               'FORJA65_STACK_RETURN_OBSERVE', 'FORJA65_INPUT_LOGIC',
               'FORJA65_LOGIC_STATE_OUT', 'FORJA65_LOGIC_DIGEST_OUT',
               'FORJA65_INPUT_LOGIC_WALL_OUT', 'FORJA65_FRAME_HASH_PATH',
               'FORJA65_HEADLESS_FRAMES', 'FORJA65_CPU_AOT_ONLY',
               'FORJA65_SRAM_PATH', 'FORJA65_CPU_INTERPRETER')
    return {k: v for k, v in environ.items()
            if k not in removed and not any(k.startswith(p) for p in prefixes)}


def build(project, folder, jobs):
    cmd = ['cmake', '-S', str(project), '-B', str(folder), '-DCMAKE_BUILD_TYPE=Release']
    subprocess.run(cmd, check=True, capture_output=True, text=True)
    subprocess.run(['cmake', '--build', str(folder), '--config', 'Release', '--target', 'game', '-j', str(jobs)],
                   check=True, capture_output=True, text=True)
    for x in (folder/'game', folder/'game.exe', folder/'Release'/'game.exe', folder/'bin'/'game'):
        if x.is_file():
            return x.resolve()
    raise ValueError(f'compiled game executable not found in {folder}')


def run_game(exe, directory, project, logic, frames, strict, timeout, common_env):
    directory.mkdir(parents=True, exist_ok=True)
    # Generate self-contained isolated working directories; the binary resolves
    # cart-data.bin and other assets relative to cwd.
    assets = project/'assets'
    if not assets.is_dir(): raise ValueError('project assets directory absent')
    if not (directory/'assets').exists(): shutil.copytree(assets, directory/'assets')
    env = assert_no_cross_run_env(common_env)
    env.update({'FORJA65_HEADLESS': '1', 'FORJA65_UNCAPPED': '1',
                'FORJA65_HEADLESS_FRAMES': str(frames), 'FORJA65_CPU_AOT_ONLY': '1' if strict else '0',
                'FORJA65_CPU_INTERPRETER':'1',
                'FORJA65_INPUT_LOGIC': str(logic), 'FORJA65_LOGIC_STATE_OUT': str(directory/'logic-state.bin'),
                'FORJA65_LOGIC_DIGEST_OUT': str(directory/'logic-digests.bin'),
                'FORJA65_SRAM_PATH': str(directory/'isolated.srm'),
                'FORJA65_FRAME_HASHES': '1', 'FORJA65_FRAME_HASH_PATH': str(directory/'frame-hashes.txt')})
    if not strict:
        env['FORJA65_STACK_RETURN_OBSERVE'] = str(directory/'returns.txt')
    # Remove stale diagnostics copied from external runs.
    t = subprocess.run([str(exe)], cwd=directory, env=env, stdout=subprocess.PIPE,
                       stderr=subprocess.STDOUT, text=True, timeout=timeout)
    (directory/'run.log').write_text(t.stdout[-200000:], encoding='utf-8')
    (directory/'exit-code.txt').write_text(str(t.returncode)+'\n')
    return {'exit_code': t.returncode, 'executable_sha256': sha(exe),
            'log_tail': t.stdout[-2000:]}


def read_frame_hashes(path: Path):
    if not path.is_file():
        return []
    rows = []
    for line in path.read_text().splitlines():
        m = HASH_LINE.fullmatch(line.strip())
        if not m:
            raise ValueError(f'invalid hash record: {line[:120]}')
        rows.append({'frame': int(m[1]), 'framebuffer': m[2].lower(),
                     'wram': m[3].lower(), 'pc': m[4].lower()})
    if len(set(x['frame'] for x in rows)) != len(rows):
        raise ValueError('duplicate frame hashes')
    if len(rows) > 1 and any(y['frame'] != x['frame']+1 for x,y in zip(rows, rows[1:])):
        raise ValueError('frame hash discontinuity')
    return rows


def kv(path):
    if not path.is_file():
        return {}
    return dict(line.strip().split('=',1) for line in path.read_text().splitlines() if '=' in line)


def evidence(folder: Path, input_count: int, frames: int):
    state = folder / 'logic-state.bin'
    done = kv(folder/'forja65-logic-replay-done.txt')
    raw = state.read_bytes() if state.is_file() else b''
    if len(raw)%64:
        raise ValueError('truncated logical state evidence')
    states = []
    for i in range(0, len(raw), 64):
        rec = raw[i:i+64]
        # Store logic sequence and WRAM, never wall-clock frame in equivalence.
        k = int.from_bytes(rec[4:8], 'little')
        states.append((int.from_bytes(rec[0:4], 'little'), k, rec[8:]))
    # REV202: o runtime REV199-REV201 continua gravando registros depois que a fita
    # acaba (entrada neutra). Eles nao fazem parte da rota; so os N primeiros contam.
    post_route = max(0, len(states) - input_count)
    states = states[:input_count]
    monotonic = all(k == i+1 for i,(_,k,_) in enumerate(states))
    dig_file = folder/'logic-digests.bin'
    dig_bytes = dig_file.read_bytes() if dig_file.is_file() else b''
    if len(dig_bytes)%24: raise ValueError('truncated logical digest evidence')
    digests = []
    for i in range(0,len(dig_bytes),24):
        rec = dig_bytes[i:i+24]
        digests.append((int.from_bytes(rec[4:8],'little'), rec[8:24].hex()))
    digests = digests[:input_count]
    digest_sequence = len(digests)==input_count and all(k==i+1 for i,(k,_) in enumerate(digests))
    hashes = read_frame_hashes(folder/'frame-hashes.txt')
    mig = kv(folder/'forja65-cpu-migration.txt')
    dependency = kv(folder/'forja65-native-dependency-report.txt')
    # Some generated runtimes output status under alternate paths; absent
    # information is not zero interpreted instructions.
    # Legacy ports export CPU_MIGRATION; current generated projects export
    # NATIVE_DEPENDENCY_AUDIT. Never silently infer absent fallback=0.
    raw_cpu = mig.get('total_instructions', dependency.get('instructions', ''))
    raw_fallback = mig.get('interpreter_instructions', dependency.get('cpu_interpreter_instructions', ''))
    cpu = int(raw_cpu) if raw_cpu.isdigit() else None
    fallback = int(raw_fallback) if raw_fallback.isdigit() else None
    frontier = folder/'forja65-aot-frontier.txt'
    qa = kv(folder/'forja65-qa-status.txt')
    return {'logic_records': len(states), 'expected_logic_records': input_count, 'post_route_records_ignored': post_route,
            'digest_records':len(digests), 'digest_sequence_complete':digest_sequence,
            'logic_sequence_complete': monotonic and len(states) == input_count,
            'done_marker': done, 'done_valid': done.get('logic_inputs') == str(input_count),
            'frames_hashed': len(hashes), 'last_frame': hashes[-1]['frame'] if hashes else None,
            'cpu_instructions': cpu, 'interpreted_instructions': fallback,
            'aot_frontier_present': frontier.exists() and bool(frontier.read_text().strip()),
            'aot_frontier_text': frontier.read_text()[:2000] if frontier.is_file() else None,
            'qa_status': qa, 'qa_run_valid':qa.get('runtime_started')=='PASS' and qa.get('frames','').isdigit() and int(qa['frames'])>0 and len(hashes)>0, 'dependency_status': {k: dependency.get(k) for k in ('rom','frames','CPU_FULLY_NATIVE','PPU_REGISTER_MODEL','sa1_backend','sa1_interpreter_instructions')}, '_states': states, '_hashes': hashes, '_digests':digests}


def require_secondary_aot(dependency):
    backend = dependency.get('sa1_backend')
    if backend and backend != 'NONE':
        raise ValueError('SA1 secondary CPU AOT is not implemented or certified; research interpreter cannot certify a native route')
    count = dependency.get('sa1_interpreter_instructions')
    if count is None: count = '0'
    if not isinstance(count, str) or not count.isdigit() or int(count) != 0:
        raise ValueError('nonzero or invalid secondary CPU interpreter count')


def compare(baseline, aot):
    a, b = baseline['_states'], aot['_states']
    first = None
    for i in range(min(len(a), len(b))):
        if a[i][1:] != b[i][1:]:
            first = {'logical_input_index': i+1, 'baseline_video_frame': a[i][0],
                     'aot_video_frame': b[i][0], 'different_wram_slots': [j for j in range(56) if a[i][2][j] != b[i][2][j]][:56]}
            break
    # Frame hashes are supplementary: lag schedules can differ while logical
    # WRAM snapshots match. Do not mislabel mismatched video as a state match.
    da, db = baseline['_digests'], aot['_digests']
    dfirst = next((i+1 for i in range(min(len(da),len(db))) if da[i]!=db[i]),None)
    digests_equal = dfirst is None and len(da)==len(db) and len(da)>0
    ha, hb = baseline['_hashes'], aot['_hashes']
    ffirst = None
    for i in range(min(len(ha), len(hb))):
        if ha[i]['framebuffer'] != hb[i]['framebuffer'] or ha[i]['wram'] != hb[i]['wram']:
            ffirst = ha[i]['frame'];break
    return {'logic_equal': first is None and len(a)==len(b), 'first_logic_divergence': first,
            'aligned_visual_wram_digests_equal':digests_equal, 'first_digest_divergence':dfirst,
            'matched_logical_inputs': (first['logical_input_index']-1 if first else min(len(a),len(b))),
            'frame_equal': ffirst is None and len(ha)==len(hb) and len(ha)>0,
            'first_frame_divergence': ffirst, 'frame_hashes_baseline': len(ha), 'frame_hashes_aot': len(hb),
            'different_frame_hash_lengths': len(ha)!=len(hb),
            'wall_frame_counts_can_differ_on_lag': True}


def clean_private(e):
    return {k:v for k,v in e.items() if not k.startswith('_')}


def campaign(args):
    root = args.out.resolve()
    if (root/'certification.json').exists():
        raise ValueError('campaign directory already has a report; choose a new output directory')
    root.mkdir(parents=True, exist_ok=True)
    project = args.project.resolve();logic = args.logic.resolve()
    inputs = read_logic(logic)
    report = {'schema': 'forja65.rev200.route-certification.v1', 'status': 'NOT_CERTIFIED',
              'project': str(project), 'logic_sha256': sha(logic), 'rom_sha256': sha(project/'assets'/'cart-data.bin'),
              'expected_logic_inputs': inputs, 'limit_video_frames': args.frames,
              'requested_aot_only': True, 'profile_env':{k:v for k,v in os.environ.items() if k.startswith('FORJA65_') and k not in ('FORJA65_INPUT_REPLAY','FORJA65_CHECKPOINT_LOAD')},
              'stages': {}, 'full_hardware_native_certified': False}
    path = root/'certification.json'
    def save(): json_out(path, report)
    try:
        upgrade = upgrade_runtime(project, args.apply_verified)
        report['stages']['runtime_rev200_upgrade'] = upgrade
        if upgrade['status']=='upgrade_required':
            raise ValueError('REV199 port needs digest instrumentation; rerun with --apply-verified or use upgrade --apply')
        save()
        folder = args.build_dir.resolve() if args.build_dir else project/'build'
        if args.game:
            game = args.game.resolve()
            if not game.is_file():raise ValueError('specified baseline executable absent')
        else:
            game = build(project, folder, args.jobs)
        report['stages']['build_baseline']={'status':'PASS','exe_sha256':sha(game)};save()
        base_dir = root/'baseline'
        baseline_run = run_game(game, base_dir, project, logic, args.frames, False, args.timeout, os.environ)
        report['stages']['replay_logical'] = baseline_run
        b = evidence(base_dir, inputs, args.frames)
        report['baseline_evidence'] = clean_private(b)
        if baseline_run['exit_code'] or not b['qa_run_valid'] or not b['logic_sequence_complete'] or not b['digest_sequence_complete'] or not b['done_valid']:
            raise ValueError('baseline incomplete or logical replay not consumed')
        report['stages']['replay_logical']['status']='PASS';save()
        candidates = observe(base_dir/'returns.txt') if (base_dir/'returns.txt').exists() else []
        proof = prove_returns(project, candidates, apply=args.apply_verified)
        json_out(root/'return-proofs.json', proof)
        report['stages']['returns'] = {k:proof[k] for k in ('observed_count','direct_verified','unproven_count','applied')}
        if proof['unproven_count']:
            raise ValueError('unproven returns: add CFG evidence and regenerate; no AOT certification')
        if proof['direct_verified'] and not args.apply_verified:
            raise ValueError('verified return offsets not applied; rerun with --apply-verified')
        report['stages']['returns']['status']='PASS';save()
        rebuilt = build(project, folder, args.jobs)
        report['stages']['cpp_recompiled']={'status':'PASS','exe_sha256':sha(rebuilt)};save()
        aot_dir = root/'aot'
        aot_run = run_game(rebuilt, aot_dir, project, logic, args.frames, True, args.timeout, os.environ)
        report['stages']['aot_replay']=aot_run
        aa = evidence(aot_dir, inputs, args.frames)
        report['aot_evidence']=clean_private(aa)
        if aot_run['exit_code'] or not aa['qa_run_valid'] or not aa['logic_sequence_complete'] or not aa['digest_sequence_complete'] or not aa['done_valid']:
            raise ValueError('AOT replay incomplete, divergent, or stopped')
        if aa['aot_frontier_present']:
            raise ValueError('AOT missing native CPU PC/state frontier found')
        if aa['cpu_instructions'] is None or aa['cpu_instructions'] <= 0 or aa['interpreted_instructions'] != 0:
            raise ValueError('AOT CPU instruction counter is missing/invalid/nonzero interpreter')
        require_secondary_aot(aa['dependency_status'])
        if b['dependency_status']['rom'] is None or b['dependency_status']['rom'] != aa['dependency_status']['rom']:
            raise ValueError('baseline/AOT cartridge fingerprint differs or is absent')
        report['stages']['aot_replay']['status']='PASS';save()
        diff = compare(b, aa)
        report['stages']['differential'] = diff;save()
        if not diff['logic_equal'] or not diff['aligned_visual_wram_digests_equal']:
            raise ValueError('logical snapshot, full-WRAM or aligned framebuffer digest divergence')
        if args.require_frame_equality and not diff['frame_equal']:
            raise ValueError('strict wall-frame hash comparison failed')
        report['stages']['differential']['status']='PASS'
        report['status']='CPU_AOT_CERTIFIED'
        report['strict_cpu_aot_certified']=True
        report['certified_logical_inputs']=inputs
        report['certified_video_frames']=len(aa['_hashes'])
        report['not_proof_of_full_stage_completion']=True
        return report
    except (ValueError, OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as err:
        report['failure']={'reason':str(err), 'type':type(err).__name__}
        report['strict_cpu_aot_certified']=False
        return report
    finally:
        save()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest='action', required=True)
    up = sub.add_parser('upgrade', help='instrument an existing REV199 port while retaining its CFG')
    up.add_argument('--project', type=Path, required=True)
    up.add_argument('--apply', action='store_true')
    ins = sub.add_parser('inspect', help='review/authorize only ROM-proven direct returns')
    ins.add_argument('--project', type=Path, required=True)
    ins.add_argument('--observe', type=Path, required=True)
    ins.add_argument('--out', type=Path, required=True)
    ins.add_argument('--apply-verified', action='store_true')
    run = sub.add_parser('run', help='run full logical replay certification campaign')
    run.add_argument('--project', type=Path, required=True)
    run.add_argument('--logic', type=Path, required=True)
    run.add_argument('--game', type=Path, help='existing interpreter-enabled baseline binary')
    run.add_argument('--out', type=Path, required=True)
    run.add_argument('--build-dir', type=Path)
    run.add_argument('--frames', type=int, default=20000)
    run.add_argument('--jobs', type=int, default=2)
    run.add_argument('--timeout', type=int, default=1800)
    run.add_argument('--apply-verified', action='store_true')
    run.add_argument('--require-frame-equality', action='store_true')
    args = ap.parse_args()
    try:
        if args.action == 'upgrade':
            result = upgrade_runtime(args.project,args.apply)
            passed = result['status'] in ('upgraded','already_current')
        elif args.action == 'inspect':
            result = prove_returns(args.project, observe(args.observe), args.apply_verified)
            json_out(args.out, result)
            passed = result['unproven_count'] == 0
        else:
            if args.frames < 1 or args.jobs < 1 or args.timeout < 1:
                ap.error('invalid frames, jobs or timeout')
            result = campaign(args)
            passed = result['status']=='CPU_AOT_CERTIFIED'
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if passed else 1
    except (ValueError, OSError) as err:
        print(f'REV200: evidence invalid: {err}',file=sys.stderr)
        return 2


if __name__=='__main__':
    sys.exit(main())
