"""Reproduce selected checks from both branches; not the entire historical suite."""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
TESTS=['reference-cache-v043666', 'trace-build-cache-v043665', 'dsp-reference-v043666', 'irq-status-hold-v043666', 'spc-tset-tclr-v043666', 'audio-dsp-envelope-clock-v023', 'bus-status-v043666-video', 'audio-dsp-key-timing-v024', 'hdma-bus-cost-v043666-video', 'audio-dsp-gaussian-v022', 'audio-dsp-fir-noise-v0435', 'audio-dsp-fractional-clock-v025', 'audio-dsp-spc-interleave-v026', 'dsp-voice-mix-saturation-v043642', 'dsp-final-mix-v043645', 'dsp-live-brr-loop-v043641', 'dsp-echo-feedback-v043644', 'dsp-zero-delay-echo-v043647', 'dsp-echo-delay-latch-v043646', 'dsp-flg-internal-reset-v043649', 'audio-dsp-brr-v025', 'dsp-esa-sample-latch-v043648', 'dsp-echo-flg-dual-gate-v043650', 'dsp-timestamped-echo-gate-v043651', 'spc-reference-flags-v0431', 'spc-profile-v0431', 'spc-arithmetic-v0431', 'spc-sleep-stop-clock-v043638', 'spc-halted-timers-v043639', 'spc-dsp-boundary-gate-v043643', 'spc-addw-io-read-once-v043640', 'spc-indirect-pointer-read-order-v043659', 'spc-mov-dp-dp-order-v043656', 'spc-logic-cmp-memory-order-v043658', 'ppu-oam-shared-byte-cursor-v043664', 'spc-adc-sbc-memory-order-v043657', 'ppu-hv-latch-v04363', 'trace-disabled-build-v043665', 'ppu-cgram-shared-byte-latch-v043663', 'ppu2-open-bus-dma-v043660', 'ppu-mode7-math-v0434', 'dma-wram-conflict-v0436', 'tetris-hdma-v0400', 'ppu-mode7-latch-v0433', 'dma-startup-v0432', 'hardware-differential-v043618', 'interrupt-stack-v039', 'wram-stores-interrupt-resume', 'timing-order-v0432', 'pcm-output-v0435', 'hdma-nltr-override-v043661', 'dsp-release-endx-v043667', 'spc-io-readback-v043667', 'reference-cache-v043667', 'tetris-spc-register-edges-v0413', 'hdma-phases-v043667-hdma', 'audio-dsp-enhanced-v020', 'irq-vonly-enable-v043667', 'busy-loop-interrupt', 'irq-sparse-equivalence-v043685']

TESTS += ['dsp-envelope-output-scaling-v043683', 'merged-build-cache-v043666', 'ppu-frame-compare-v043677', 'ppu-obj-attribute-latch-v043673', 'ppu-obj-chr-latch-v043675', 'ppu-obj-early-fetch-position-v043671', 'ppu-obj-hardware-limits-v043679', 'ppu-obj-hblank-incremental-fetch-v043670', 'ppu-obj-interlace-v043676', 'ppu-obj-next-scanline-timing-v043668', 'ppu-obj-next-sprite-latch-v043672', 'ppu-obj-rotation-latch-v043669', 'ppu-obj-status-independent-v043667', 'ppu-obj-timed-raster-v043674', 'ppu1-open-bus-stat77-v043665', 'spc-timer-fast-forward-v043682', 'crossfeed-cache-v043684', 'dsp-output-merge-v043684']

TESTS += ['dsp-end-continuation-v043685', 'irq-horizontal-v043685', 'dma-register-decode-v043685', 'dma-wram-zero-v043685', 'dsp-pmon-range-v043685', 'hardware-cache-v043685', 'spc-io-ram-shadow-predictor-v043685', 'dma-payload-phase-v043685', 'spc-test-ram-control-v043685']

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quick',action='store_true',help='Run only the v67 JS regressions; omit full SPC corpus and older regressions')
    parser.add_argument('--only',help='Comma-separated check names to rerun')
    args=parser.parse_args()
    names=[n for n in TESTS if '043667' in n] if args.quick else TESTS
    tasks=[(n,['node',str(ROOT/'tests'/f'{n}-regression.js')]) for n in names]
    if not args.quick:
        tasks.append(('spc-singlestep',[sys.executable,str(ROOT/'tests/spc-singlestep-v043666-test.py')]))
        for name in ['test_irq_open_bus_v043637.py','test_rmw_interrupt_status_v043636.py']:
            tasks.append((name,[sys.executable,'-m','unittest','discover','-s','tools','-p',name,'-v']))
    if not args.quick:
        for name in ['tests/crossgame-diagnostics-v043681-selftest.py', 'tests/ppu-frame-compare-v043677-selftest.py', 'tests/ppu-reference-suite-v043678-selftest.py', 'tests/ppu-reference-suite-v043679-selftest.py', 'tests/ppu-reference-suite-v043680-selftest.py']:
            tasks.append((Path(name).stem,[sys.executable,str(ROOT/name)]))
    if args.only:
        requested=set(args.only.split(','));tasks=[t for t in tasks if t[0] in requested]
        if {t[0] for t in tasks}!=requested:parser.error('Unknown --only check name')
    log=ROOT/'reports/validation-v043685/rerun'
    log.mkdir(parents=True,exist_ok=True)
    def run(task):
        name,command=task
        try:
            env=os.environ.copy()
            # Archived v74/v75 assertions intentionally exercise these documented compatibility modes.
            if name in ['ppu-obj-timed-raster-v043674','ppu-obj-chr-latch-v043675']:
                env['FORJA65_OBJ_LEGACY_HIRES_INTERLACE']='1'
            if name=='ppu-obj-timed-raster-v043674':env['FORJA65_OBJ_LIVE_CHR']='1'
            p=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=300,env=env)
            code=p.returncode;output=p.stdout+p.stderr
        except Exception as exc:
            code=-1;output=str(exc)
        (log/(name+'.log')).write_text(output,encoding='utf-8')
        return {'test':name,'passed':code==0,'exit_code':code}
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for f in concurrent.futures.as_completed([pool.submit(run,task) for task in tasks]):
            row=f.result();results.append(row);print(('PASS ' if row['passed'] else 'FAIL ')+row['test'],flush=True)
    summary=log/'summary.json'
    if args.only and summary.exists():
        old=json.loads(summary.read_text());replaced={r['test'] for r in results}
        results=[r for r in old if r['test'] not in replaced]+results
    summary.write_text(json.dumps(results,indent=2)+'\n')
    print(f"{sum(x['passed'] for x in results)}/{len(results)} selected checks passed")
    return 0 if all(x['passed'] for x in results) else 1
if __name__=='__main__':raise SystemExit(main())
