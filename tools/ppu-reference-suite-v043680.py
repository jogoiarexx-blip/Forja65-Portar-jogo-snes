#!/usr/bin/env python3
"""Forja65 PPU v0.4.36.80: reproducible, provenance-aware frame comparisons.

The manifest hashes files and REQUIRES side-by-side sync declarations. This
cannot independently prove that a screenshot came from an external emulator,
that an input log was replayed, or that two emulators executed the same state.
Exit 0 = manifest valid and RGB comparisons match, 1 = visual differences,
2 = invalid manifest/capture, 3 = CLI/IO error (also treated as validation error).
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
from importlib import util as importlib_util

CORE = Path(__file__).with_name('ppu-frame-compare-v043677.py')
spec = importlib.util.spec_from_file_location('ppu_frame_diff_v77', CORE)
frame = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frame)

DIAG_FILE = Path(__file__).with_name('ppu-sync-diagnostics-v043680.py')
_diag_spec = importlib_util.spec_from_file_location('ppu_capture_sync_v80', DIAG_FILE)
diag = importlib_util.module_from_spec(_diag_spec)
_diag_spec.loader.exec_module(diag)
SCHEMA = 'forja65.ppu.reference_suite.v1'
HEX = re.compile(r'^[a-fA-F0-9]{64}$')
CASE_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$')
SYNC_FIELDS = ('rom_sha256', 'input_replay_sha256', 'checkpoint_id',
               'frame_number', 'field', 'bg_mode', 'setini_2133',
               'video_standard', 'viewport', 'width', 'height')
SYNC_TEMPLATE = dict(rom_sha256='', input_replay_sha256='', checkpoint_id='',
                     frame_number=None, field=None, bg_mode=None, setini_2133=None,
                     video_standard='', viewport='', width=None, height=None)

class SuiteError(ValueError):
    pass


def reject(condition, detail):
    if condition:
        raise SuiteError(detail)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def contained_path(bundle, value):
    reject(not isinstance(value, str) or not value or '\\' in value, 'capture path must be a relative slash-separated path')
    path = Path(value)
    reject(path.is_absolute() or '..' in path.parts or '.' in path.parts, 'capture path cannot be absolute or traverse parents')
    full = (bundle/path).resolve()
    reject(not full.is_relative_to(bundle.resolve()) or not full.is_file(), f'capture missing/invalid/outside bundle: {value}')
    reject(full.suffix.lower() not in ('.png', '.ppm'), f'unsupported capture format: {value}')
    return full


def validate_capture(bundle, entry, name):
    reject(not isinstance(entry, dict), f'{name}: must be an object')
    path = contained_path(bundle, entry.get('path'))
    claimed = entry.get('sha256')
    reject(not isinstance(claimed, str) or not HEX.fullmatch(claimed), f'{name}: sha256 required (64 hex digits)')
    actual_hash = digest(path)
    reject(claimed.lower() != actual_hash, f'{name}: SHA-256 mismatch for {entry["path"]} (capture altered)')
    reject(not isinstance(entry.get('producer'), str) or not entry['producer'].strip(), f'{name}: producer required')
    reject(not isinstance(entry.get('producer_version'), str) or not entry['producer_version'].strip(), f'{name}: producer_version required')
    return path, actual_hash


def validate_sync(sync, label):
    reject(not isinstance(sync, dict), f'{label}: synchronization data required')
    reject(set(SYNC_FIELDS) != set(sync), f'{label}: expected fields {SYNC_FIELDS}')
    for field_name in ('rom_sha256', 'input_replay_sha256'):
        reject(not isinstance(sync[field_name], str) or not HEX.fullmatch(sync[field_name]), f'{label}.{field_name}: 64-digit SHA-256 required')
    reject(not isinstance(sync['checkpoint_id'], str) or not sync['checkpoint_id'].strip() or sync['checkpoint_id'].lower().startswith(('todo','preencher')), f'{label}: checkpoint_id required')
    for key, low, high in [('frame_number', 0, 1_000_000_000), ('bg_mode', 0, 7), ('setini_2133', 0, 255), ('width', 1, 4096), ('height', 1, 4096)]:
        val = sync[key]
        reject(type(val) is not int or not low <= val <= high, f'{label}.{key} must be an integer in [{low},{high}]')
    reject(sync['field'] not in ('even', 'odd', 'none'), f'{label}.field must be even, odd or none')
    reject(sync['video_standard'] not in ('NTSC','PAL'), f'{label}.video_standard must be NTSC or PAL')
    reject(sync['viewport'] != 'raw-no-overlay-no-crop', f'{label}.viewport must be raw-no-overlay-no-crop')
    reject(sync['width'] * sync['height'] > 8_388_608, f'{label}: dimensions too large')


def appearance(diff):
    if not diff['different_pixels']:
        return 'identical'
    if diff['different_pixels'] <= 4:
        return 'isolated_pixels'
    box = diff['bounding_box']
    width = box[2]-box[0]+1
    height = box[3]-box[1]+1
    if height <= 2 and width >= 32:
        return 'horizontal_band'
    if width <= 2 and height >= 16:
        return 'vertical_band'
    if diff['different_fraction'] >= 0.25:
        return 'widespread'
    return 'localized_or_multiple'


def init(args):
    bundle = args.bundle.resolve()
    reject(not bundle.is_dir(), f'bundle directory does not exist: {bundle}')
    refs = contained_dir(bundle, args.reference_dir)
    acts = contained_dir(bundle, args.actual_dir)
    pairs = frame.list_pairs(refs, acts)
    manifest = {'schema': SCHEMA,
        'instructions': 'Preencha todos os campos de sincronização de CADA captura a partir dos registros dos dois emuladores; valores iguais aqui são declarações, não provas.',
        'cases': []}
    for name, ref, act in pairs:
        # A single file cannot serve as both sides of a reference comparison.
        reject(os.path.samefile(ref, act), f'{name}: reference and actual must be distinct files')
        case_id = Path(name).stem
        reject(not CASE_ID.fullmatch(case_id), f'invalid case id from filename: {case_id}')
        data = {
            'id': case_id,
            'reference': {'path': ref.relative_to(bundle).as_posix(), 'sha256': digest(ref),
                          'producer': 'PREENCHER', 'producer_version': 'PREENCHER',
                          'kind': 'unverified', 'capture_method': 'PREENCHER'},
            'actual': {'path': act.relative_to(bundle).as_posix(), 'sha256': digest(act),
                       'producer': 'Forja65', 'producer_version': '0.4.36.80'},
            'reference_sync': SYNC_TEMPLATE.copy(),
            'actual_sync': SYNC_TEMPLATE.copy(),
            'threshold': 0,
        }
        manifest['cases'].append(data)
    output = bundle/'manifest.json'
    reject(output.exists() and not args.overwrite, 'manifest.json exists; use --overwrite only if intentional')
    output.write_text(json.dumps(manifest, indent=2, ensure_ascii=False)+'\n', encoding='utf8')
    print(f'Created {output}: {len(pairs)} pairs; complete metadata before validating.')
    return 0


def contained_dir(bundle, text):
    reject(not isinstance(text, str) or not text or '\\' in text, 'directory must be relative to bundle')
    rel = Path(text)
    reject(rel.is_absolute() or '..' in rel.parts, 'directory must be inside bundle')
    path = (bundle/rel).resolve()
    reject(not path.is_relative_to(bundle) or not path.is_dir(), f'directory missing/outside bundle: {text}')
    return path


def verify(args):
    manifest_path = args.manifest.resolve()
    reject(not manifest_path.is_file(), f'manifest missing: {manifest_path}')
    bundle = manifest_path.parent
    obj = json.loads(manifest_path.read_text(encoding='utf8'))
    reject(not isinstance(obj, dict) or obj.get('schema') != SCHEMA, 'invalid manifest schema')
    cases = obj.get('cases')
    reject(not isinstance(cases, list) or not cases, 'at least one case required')
    reject(len(cases) > 2000, 'too many cases')
    # Validate every case and hash BEFORE writing any artifacts, to avoid a
    # report suggesting that a partially examined suite was successful.
    loaded = []
    names = set()
    ref_paths, actual_paths = set(), set()
    ref_inodes, actual_inodes = set(), set()
    for case in cases:
        reject(not isinstance(case, dict), 'case must be an object')
        name = case.get('id')
        reject(not isinstance(name, str) or not CASE_ID.fullmatch(name) or name in names, f'invalid/duplicate case id: {name}')
        names.add(name)
        rp, rhash = validate_capture(bundle, case.get('reference'), f'{name}.reference')
        ap, ahash = validate_capture(bundle, case.get('actual'), f'{name}.actual')
        reject(os.path.samefile(rp, ap), f'{name}: reference and actual are the same file/inode')
        # Also reject using a reference from another case as actual: this
        # frequently masks copy/paste mistakes in multi-frame test bundles.
        ref_paths.add(rp.resolve())
        actual_paths.add(ap.resolve())
        # Cross-case hard links can bypass path equality; on ordinary local
        # file systems the device/inode pair identifies aliased captures.
        for path, identities in ((rp, ref_inodes), (ap, actual_inodes)):
            st = path.stat()
            if st.st_ino: identities.add((st.st_dev, st.st_ino))
        reject('forja65' not in case['actual']['producer'].lower(), f'{name}: actual capture must identify Forja65 producer')
        meta = case['reference']
        reject(meta.get('kind') not in ('external_emulator', 'hardware', 'forja65_internal', 'unverified'), f'{name}: bad reference kind')
        reject(not isinstance(meta.get('capture_method'), str) or not meta['capture_method'].strip(), f'{name}: capture_method required')
        if args.require_external:
            reject(meta['kind'] not in ('external_emulator','hardware'), f'{name}: require external emulator or hardware reference')
            reject('forja' in meta['producer'].lower() or meta['producer'].strip().lower().startswith(('preencher','todo')), f'{name}: independent producer name required')
            reject(meta['producer_version'].strip().lower().startswith(('preencher','todo')), f'{name}: independent producer version required')
            reject(meta['capture_method'].strip().lower().startswith(('preencher','todo')), f'{name}: capture method required')
        rs, ast = case.get('reference_sync'), case.get('actual_sync')
        validate_sync(rs, f'{name}.reference_sync')
        validate_sync(ast, f'{name}.actual_sync')
        reject(rs != ast, f'{name}: reference/actual sync mismatch; check ROM/input/frame/field/mode/viewport')
        threshold = case.get('threshold', 0)
        reject(type(threshold) is not int or not 0 <= threshold <= 255, f'{name}: threshold out of range')
        roi = case.get('roi')
        reject(roi is not None and (not isinstance(roi, list) or len(roi) != 4 or any(type(i) is not int for i in roi)), f'{name}: invalid ROI')
        ref = frame.load_image(rp)
        actual = frame.load_image(ap)
        reject((ref['width'], ref['height']) != (rs['width'],rs['height']), f'{name}: image size differs from declared viewport')
        reject((actual['width'], actual['height']) != (rs['width'],rs['height']), f'{name}: actual image size differs from declared viewport')
        loaded.append((name,ref,actual,rs,meta,threshold,roi,rhash,ahash))

    reject(bool(ref_paths & actual_paths) or bool(ref_inodes & actual_inodes),
           'capture reused as reference and actual across cases (path or inode)')
    out = args.output_dir.resolve()
    # Do not write diagnostics into any directory containing source captures.
    source_folders = {Path(item['file']).resolve().parent for tup in loaded for item in (tup[1], tup[2])}
    reject(out == bundle or any(out == parent or out.is_relative_to(parent) or parent.is_relative_to(out)
                                for parent in source_folders),
           'output directory overlaps input capture directories')
    # Case IDs control report names. Never overwrite an existing capture, even
    # one stored in a nested layout rather than reference/ and actual/.
    reject(any((out / f'{item[0]}-heatmap.ppm').resolve() in ref_paths | actual_paths
               for item in loaded), 'heatmap output would overwrite an input capture')
    out.mkdir(parents=True, exist_ok=True)
    report_cases=[]
    total=0
    for case_index, (name,ref,act,sync,meta,threshold,roi,rhash,ahash) in enumerate(loaded):
        roi_text = ','.join(map(str,roi)) if roi is not None else None
        try:
            diff,heat=frame.diff_pair(ref,act,roi_text,threshold,16)
        except frame.ImageError as exc:
            raise SuiteError(f'{name}: {exc}') from exc
        heatmap=f'{name}-heatmap.ppm'
        frame.save_ppm(out/heatmap,ref['width'],ref['height'],heat)
        # Diagnostics use bounded sampling. They NEVER re-align captures, change
        # diff['different_pixels'], or turn a failure into a passing result.
        if args.skip_sync_diagnostics:
            diagnostic = {'enabled': False}
        else:
            roi_dims = tuple(roi) if roi is not None else None
            diagnostic = {'enabled': True, 'sampling_only': True,
                'spatial': diag.spatial(ref, act, roi_dims, threshold),
                'temporal': diag.temporal(case_index, loaded, threshold)}
        diff.update(sync_diagnostics=diagnostic)
        diff.update(id=name, reference_sha256=rhash, actual_sha256=ahash,
                    reference_kind=meta['kind'], reference_producer=meta['producer'],
                    reference_producer_version=meta['producer_version'],
                    reference_capture_method=meta['capture_method'],
                    sync=sync, appearance=appearance(diff), heatmap=heatmap)
        report_cases.append(diff)
        total += diff['different_pixels']
        print(f'{name}: different pixels {diff["different_pixels"]}/{diff["pixels_compared"]} [{diff["appearance"]}]')
    result = {
        'schema': 'forja65.ppu.reference_suite_report.v1',
        'manifest_sha256': digest(manifest_path),
        'independent_reference_verified': False,
        'provenance': 'Captures and synchronization metadata are operator-declared. Only file integrity and equality of declarations are checked; emulator origin and execution synchronization are NOT independently certified.',
        'diagnostics_are_non_corrective': True,
        'sync_diagnostics_enabled': not args.skip_sync_diagnostics,
        'capture_count': len(loaded),
        'total_different_pixels': total,
        'matched': total == 0,
        'require_external_source_label': args.require_external,
        'cases': report_cases,
    }
    (out/'summary.json').write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n', encoding='utf8')
    return 1 if total else 0


def main():
    p=argparse.ArgumentParser(description=__doc__)
    sub=p.add_subparsers(dest='action', required=True)
    i=sub.add_parser('init',help='generate a template manifest and file SHA-256 values')
    i.add_argument('--bundle',type=Path,required=True)
    i.add_argument('--reference-dir',default='reference')
    i.add_argument('--actual-dir',default='actual')
    i.add_argument('--overwrite',action='store_true')
    v=sub.add_parser('verify',help='validate metadata/hashes and compare actual pixels')
    v.add_argument('--manifest',type=Path,required=True)
    v.add_argument('--output-dir',type=Path,required=True)
    v.add_argument('--require-external',action='store_true',help='require operator-declared external reference type, producer and version')
    v.add_argument('--skip-sync-diagnostics',action='store_true',help='disable spatial/temporal hints (does not affect pixel verdict)')
    args=p.parse_args()
    try:
        return init(args) if args.action == 'init' else verify(args)
    except (SuiteError, frame.ImageError, OSError, json.JSONDecodeError) as exc:
        print(f'PPU_REFERENCE_SUITE_ERROR: {exc}', file=sys.stderr)
        return 2

if __name__=='__main__':
    sys.exit(main())
