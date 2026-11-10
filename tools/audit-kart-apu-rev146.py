#!/usr/bin/env python3
"""REV146 source audit: what really migrated from Forja65 to a SNES port.

The audit is an *integration inventory*, not a gameplay proof. It explicitly
rejects the misleading claim that copying timing logic also migrates the
full SPC AOT, PPU, CPU interpreter or DSP runtime.
"""
from pathlib import Path
import argparse,json,datetime,sys

def check(source,needle):return needle in source

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--port',required=True,help='path to port root containing src/runtime.hpp')
    ap.add_argument('--generator',default=str(Path(__file__).resolve().parents[1]/'forja65-core.js'))
    ap.add_argument('--out',required=True)
    args=ap.parse_args()
    root=Path(args.port)
    s=(root/'src/runtime.hpp').read_text(errors='replace')
    main=(root/'src/main.cpp').read_text(errors='replace')
    c=(root/'src/forja_checkpoint.hpp').read_text(errors='replace')
    core=Path(args.generator).read_text(errors='replace')
    features={
      'history_ring_16':check(s,'std::array<PortOutEvent,16> portOutHistory'),
      'spc_writes_record_old_value':check(s,'notePortOutWrite(a-0xF4u'),
      'rational_scheduler_stamps_completions':check(s,'stampPortOutWrites(masterObserved-credit/(std::uint64_t)spcHz)'),
      'legacy_scheduler_stamps_completions':check(s,'spcMasterRemainder-=42;forja65SpcStep(*this);if(portOutPendingMask)'),
      'reads_use_timed_history':check(s,'const auto value=portOutAt(i);'),
      'cpu_read_lag_data_width':check(s,'4u+6u*after'),
      'cpu_bus_wired':check(s,'apu.cpuReadLagMc=cpuApuReadLag();'),
      'optin_flag':check(s,'FORJA65_APU_READ_TIMING'),
      'checkpoint_ring':check(c,'F(hw.apu.portOutHistory);'),
      'checkpoint_cpu_instruction_context':check(c,'F(hw.instrDataWidth);'),
      'qa_logs_selected_mode':check(main,'apu_port_read_timing='),
      'generator_has_source_feature':check(core,'portOutHistoryPos') and check(core,'cpuApuReadLag()'),
    }
    missing=[key for key,ok in features.items() if not ok]
    report={'revision':'rev146','audit':'SOURCE_ONLY_NOT_GAMEPLAY_VERIFICATION',
            'ported_features':features,'missing':missing,'port_generated_origin':'REV137',
            'generator_base':'REV143 with REV146 validation patch',
            'not_migrated':['SPC700 AOT','whole 65C816 timing','PPU core','S-DSP core','CFG generator'],
            'verdict':'APU_PORT_CROSSFEED_INVENTORY_PASS' if not missing else 'APU_PORT_CROSSFEED_INCOMPLETE'}
    target=Path(args.out);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(report['verdict'],f'checks={sum(features.values())}/{len(features)}')
    return 0 if not missing else 2
if __name__=='__main__':sys.exit(main())
