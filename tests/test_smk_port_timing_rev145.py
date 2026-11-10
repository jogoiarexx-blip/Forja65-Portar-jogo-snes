import importlib.util
from pathlib import Path
import tempfile

module = Path(__file__).resolve().parents[1] / 'tools' / 'audit-snes-port-timing-rev145.py'
spec=importlib.util.spec_from_file_location('timing_audit',module)
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
with tempfile.TemporaryDirectory() as d:
    d=Path(d)
    r=d/'runtime.hpp';m=d/'main.cpp';t=d/'input.trace'
    r.write_text('''FORJA65_TIMING_PROFILE 1025280ull
forja65SpcClockHz()
const auto spcHz=(std::int64_t)forja65SpcClockHz();
s.ntscSpcClock?forja65SpcClockHz():1ull;''')
    m.write_text('spc_clock_hz= apu_timing_profile=')
    t.write_text('# FORJA65_INPUT_TRACE 1\n# FORJA65_ENV FORJA65_SPC_PROFILE=reference\nframe=1 joy1=0000\n# FORJA65_ENV FORJA65_TIMING_PROFILE=rev143\n')
    result=audit.scan(r,m,t)
    assert result['status']=='PASS_SOURCE_BRIDGE' and result['full_rev143_runtime_migration_proven'] is False
    assert result['trace_environment']=={'FORJA65_SPC_PROFILE':'reference'}
    assert result['checks']['qa_reports_actual_selected_profile']
    r.write_text('''FORJA65_TIMING_PROFILE 1025280ull
forja65SpcClockHz()\nconstexpr std::int64_t spcHz=1024000;
s.ntscSpcClock?1024000ull:1ull;''')
    result=audit.scan(r,m,t)
    assert result['status']=='FAIL_SOURCE_BRIDGE'
    assert not result['checks']['no_legacy_hardcoded_running_spc']
    assert not result['checks']['no_legacy_hardcoded_halted_spc']
print('PASS REV145 Forja65 portable source-audit regression')
