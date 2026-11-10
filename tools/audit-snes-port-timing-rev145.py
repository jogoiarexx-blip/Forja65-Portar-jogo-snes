#!/usr/bin/env python3
"""REV145: audit profile migration for a generated SNES C++ port.

This is a *source audit*, not proof of behavioral equivalence. It deliberately
never labels an interpreter-backed port 100% native. The script uses only the
Python standard library and does not require a game ROM or modify the port.
"""
import argparse
import json
from pathlib import Path
import re
import sys


def read_trace_env(path):
    result = {}
    if not path:
        return result
    with Path(path).open('rt', encoding='utf-8', errors='replace') as f:
        for i, line in enumerate(f):
            if i >= 100 or (line and line[0] != '#'):
                break
            m = re.match(r'^# FORJA65_ENV (FORJA65_[A-Z0-9_]+)=([^\r\n]+)', line)
            if m:
                result[m.group(1)] = m.group(2)
    return result


def scan(runtime, main='', trace=''):
    src = Path(runtime).read_text(encoding='utf-8')
    exe = Path(main).read_text(encoding='utf-8') if main else ''
    env = read_trace_env(trace)
    has_clock = 'forja65SpcClockHz()' in src
    old_hardcoded_running = bool(re.search(r'\bspcHz\s*=\s*1024000\b', src))
    old_hardcoded_halted = bool(re.search(r'ntscSpcClock\s*\?\s*1024000', src))
    has_rev143 = '1025280ull' in src and 'FORJA65_TIMING_PROFILE' in src
    scheduler_uses_bridge = bool(re.search(r'spcHz\s*=\s*\(std::int64_t\)forja65SpcClockHz\(\)', src))
    halt_uses_bridge = bool(re.search(r'ntscSpcClock\s*\?\s*forja65SpcClockHz\(\)', src))
    injected_qa = 'spc_clock_hz=' in exe and 'apu_timing_profile=' in exe
    compatible = has_clock and has_rev143 and scheduler_uses_bridge and halt_uses_bridge \
        and not old_hardcoded_running and not old_hardcoded_halted
    checks = {
        'frequency_bridge_present': has_clock,
        'rev143_1025280_hz_available': has_rev143,
        'running_spc_uses_bridge': scheduler_uses_bridge,
        'halted_spc_uses_bridge': halt_uses_bridge,
        'no_legacy_hardcoded_running_spc': not old_hardcoded_running,
        'no_legacy_hardcoded_halted_spc': not old_hardcoded_halted,
        'qa_reports_actual_selected_profile': injected_qa if main else None,
    }
    status = 'PASS_SOURCE_BRIDGE' if compatible else 'FAIL_SOURCE_BRIDGE'
    warnings = []
    if env.get('FORJA65_SPC_PROFILE') == 'reference':
        warnings.append('Recorded reference SPC semantics do not prove a REV143 master-clock profile.')
    if not env.get('FORJA65_TIMING_PROFILE'):
        warnings.append('Trace has no explicit REV143 timing profile: preserve legacy mode for this replay.')
    if compatible:
        warnings.append('Clock migration only. CPU/PPU/DMA/HDMA/ROM/DSP hardware equivalence NOT established.')
    else:
        warnings.append('Do not run the trace with forced REV143 clock and claim deterministic replay.')
    return {
        'revision': 'rev145',
        'status': status,
        'checks': checks,
        'trace_environment': env,
        'warnings': warnings,
        'full_rev143_runtime_migration_proven': False,
        'all_races_classified': None,
        'rom_pack_native_percent': None,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--runtime', type=Path, required=True)
    p.add_argument('--main', type=Path)
    p.add_argument('--trace', type=Path)
    p.add_argument('--output', type=Path)
    a = p.parse_args()
    report = scan(a.runtime, a.main, a.trace)
    content = json.dumps(report, indent=2, ensure_ascii=False) + '\n'
    if a.output:
        a.output.parent.mkdir(parents=True, exist_ok=True)
        a.output.write_text(content, encoding='utf-8')
    else:
        print(content, end='')
    return 0 if report['status'] == 'PASS_SOURCE_BRIDGE' else 1


if __name__ == '__main__':
    sys.exit(main())
