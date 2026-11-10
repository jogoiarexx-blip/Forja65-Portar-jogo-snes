"""Reproduce the selected v67 regression checks; not the entire historical suite."""
import argparse
import concurrent.futures
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
TESTS=['reference-cache-v043666', 'trace-build-cache-v043665', 'dsp-reference-v043666', 'irq-status-hold-v043666', 'spc-tset-tclr-v043666', 'audio-dsp-envelope-clock-v023', 'bus-status-v043666-video', 'audio-dsp-key-timing-v024', 'hdma-bus-cost-v043666-video', 'audio-dsp-gaussian-v022', 'audio-dsp-fir-noise-v0435', 'audio-dsp-fractional-clock-v025', 'audio-dsp-spc-interleave-v026', 'dsp-voice-mix-saturation-v043642', 'dsp-final-mix-v043645', 'dsp-live-brr-loop-v043641', 'dsp-echo-feedback-v043644', 'dsp-zero-delay-echo-v043647', 'dsp-echo-delay-latch-v043646', 'dsp-flg-internal-reset-v043649', 'audio-dsp-brr-v025', 'dsp-esa-sample-latch-v043648', 'dsp-echo-flg-dual-gate-v043650', 'dsp-timestamped-echo-gate-v043651', 'spc-reference-flags-v0431', 'spc-profile-v0431', 'spc-arithmetic-v0431', 'spc-sleep-stop-clock-v043638', 'spc-halted-timers-v043639', 'spc-dsp-boundary-gate-v043643', 'spc-addw-io-read-once-v043640', 'spc-indirect-pointer-read-order-v043659', 'spc-mov-dp-dp-order-v043656', 'spc-logic-cmp-memory-order-v043658', 'ppu-oam-shared-byte-cursor-v043664', 'spc-adc-sbc-memory-order-v043657', 'ppu-hv-latch-v04363', 'trace-disabled-build-v043665', 'ppu-cgram-shared-byte-latch-v043663', 'ppu2-open-bus-dma-v043660', 'ppu-mode7-math-v0434', 'dma-wram-conflict-v0436', 'tetris-hdma-v0400', 'ppu-mode7-latch-v0433', 'dma-startup-v0432', 'hardware-differential-v043618', 'interrupt-stack-v039', 'wram-stores-interrupt-resume', 'timing-order-v0432', 'pcm-output-v0435', 'hdma-nltr-override-v043661', 'dsp-release-endx-v043667', 'spc-io-readback-v043667', 'reference-cache-v043667', 'tetris-spc-register-edges-v0413', 'hdma-phases-v043667-hdma', 'audio-dsp-enhanced-v020', 'irq-vonly-enable-v043667', 'busy-loop-interrupt', 'irq-sparse-equivalence-v043667']

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quick',action='store_true',help='Run only the v67 JS regressions; omit full SPC corpus and older regressions')
    args=parser.parse_args()
    names=[n for n in TESTS if '043667' in n] if args.quick else TESTS
    tasks=[(n,['node',str(ROOT/'tests'/f'{n}-regression.js')]) for n in names]
    if not args.quick:
        tasks.append(('spc-singlestep',[sys.executable,str(ROOT/'tests/spc-singlestep-v043666-test.py')]))
        for name in ['test_irq_open_bus_v043637.py','test_rmw_interrupt_status_v043636.py']:
            tasks.append((name,[sys.executable,'-m','unittest','discover','-s','tools','-p',name,'-v']))
    log=ROOT/'reports/validation-v043667/rerun'
    log.mkdir(parents=True,exist_ok=True)
    def run(task):
        name,command=task
        try:
            p=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=300)
            code=p.returncode;output=p.stdout+p.stderr
        except Exception as exc:
            code=-1;output=str(exc)
        (log/(name+'.log')).write_text(output,encoding='utf-8')
        return {'test':name,'passed':code==0,'exit_code':code}
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for f in concurrent.futures.as_completed([pool.submit(run,task) for task in tasks]):
            row=f.result();results.append(row);print(('PASS ' if row['passed'] else 'FAIL ')+row['test'],flush=True)
    (log/'summary.json').write_text(json.dumps(results,indent=2)+'\n')
    print(f"{sum(x['passed'] for x in results)}/{len(results)} selected checks passed")
    return 0 if all(x['passed'] for x in results) else 1
if __name__=='__main__':raise SystemExit(main())
