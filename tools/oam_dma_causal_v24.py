#!/usr/bin/env python3
"""Forja65 v2.4: audita origem A-bus -> $2104 -> OAM, sem alterar o jogo.

Atribuição forte requer trilha de bytes realmente transferidos e snapshot OAM.
Um sprite transferido NÃO prova colisão, pontuação ou vitória.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
from pathlib import Path

HEADER = ["frame", "pc", "channel", "source", "bbus", "value", "oam_word_before", "flip_before", "oam_word_after", "flip_after"]
SCHEMA = "forja65.dma-oam-causal/1"
TARGETS = [(0x7e022e, 0x7e023e), (0x7e0258, 0x7e025a), (0x7e0910, 0x7e0912),
           (0x7e091c, 0x7e091e), (0x7e0928, 0x7e092a)]


def canonical_wram(a: int) -> int:
    """SNES LoWRAM mirror banks 00-3F/80-BF:$0000-$1FFF to $7E0000."""
    bank, offset = a >> 16, a & 0xFFFF
    if (0x00 <= bank <= 0x3F or 0x80 <= bank <= 0xBF) and offset < 0x2000:
        return 0x7E0000 | offset
    return a


def parse_tape(path: Path):
    with path.open(newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        if r.fieldnames != HEADER:
            raise ValueError("header de transferencia OAM incompatível")
        events = []
        prev_frame = -1
        for x in r:
            frame = int(x["frame"])
            src = int(x["source"], 16)
            pc = int(x["pc"], 16)
            bbus = int(x["bbus"], 16)
            channel = int(x["channel"])
            value = int(x["value"])
            word = int(x["oam_word_before"])
            aft = int(x["oam_word_after"])
            flip = int(x["flip_before"])
            next_flip = int(x["flip_after"])
            if not (frame >= prev_frame >= -1 and 0 <= channel < 8 and
                    0 <= pc <= 0xffffff and 0 <= src <= 0xffffff and bbus == 0x2104 and
                    0 <= value <= 255 and 0 <= word <= 511 and 0 <= aft <= 511 and
                    flip in (0, 1) and next_flip == 1-flip and
                    aft == ((word + (flip == 1)) & 511)):
                raise ValueError(f"transferencia invalida no frame {frame}")
            prev_frame = frame
            events.append(dict(frame=frame, pc=f"{pc:06X}", channel=channel, source=f"{src:06X}",
                               src=src, value=value, word=word, flip=flip,
                               physical_index=( ((word & 15) << 1) + flip + 512 if word & 256 else
                                               ((word & 255) << 1) + (flip == 1) )))
    if not events:
        raise ValueError("arquivo vazio: nenhuma transferencia DMA->OAM confirmada")
    return events


def audit(tape: Path, oam_dir: Path, regions=TARGETS):
    events = parse_tape(tape)
    seen = sorted({x["frame"] for x in events})
    snapshots = {}
    for frame in seen:
        p = oam_dir / f"oam-{frame:08d}.bin"
        if p.exists():
            contents = p.read_bytes()
            if len(contents) != 544:
                raise ValueError(f"snapshot OAM incompleto: {p}")
            snapshots[frame] = contents
    # High OAM writes are immediate, low OAM writes commit a pair on the second byte.
    # Intermediate DMA bytes may be overwritten later in the same frame.
    observations = []
    for x in events:
        if not any(start <= canonical_wram(x["src"]) < end for start, end in regions):
            continue
        index = x["physical_index"]
        snap = snapshots.get(x["frame"])
        # The final OAM bytes can be equal by coincidence, and CPU writes between
        # DMA and snapshot are not covered. This is corroboration, not absolute proof.
        corroborates = None if snap is None else (snap[index] == x["value"])
        observations.append(dict(frame=x["frame"], pc=x["pc"], channel=x["channel"],
                                 source=x["source"], canonical_wram_source=f"{canonical_wram(x["src"]):06X}", oam_index=index,
                                 transferred_value=x["value"], end_frame_value_matches=corroborates))
    total_match = sum(x["end_frame_value_matches"] is True for x in observations)
    summary = {
        "schema": SCHEMA,
        "status": "SOURCE_TO_OAM_BYTES_OBSERVED" if observations else "NO_CANDIDATE_SOURCE_TRANSFER_OBSERVED",
        "source_sha256": hashlib.sha256(tape.read_bytes()).hexdigest(),
        "events_dma_to_2104": len(events),
        "frames_in_tape": seen,
        "frames_with_oam_snapshot": sorted(snapshots),
        "candidate_transferred_bytes": len(observations),
        "candidate_bytes_by_frame": {str(f):sum(e["frame"]==f for e in observations) for f in seen},
        "candidate_endframe_oam_matches": total_match,
        "candidate_regions": [[f"{start:06X}", f"{end-1:06X}"] for start, end in regions],
        "first_128_candidate_transfer_events": observations[:128],
        "validated": {
            "actual_dma_2104_bytes": True,
            "matching_end_frame_samples_exist": bool(total_match),
            "low_wram_mirror_canonicalization": True,
            "all_oam_writers_covered": False,
            "sprite_identity": False,
            "board_cells": False,
            "collision": False,
            "score": False,
            "board_clear": False,
            "stage_transition": False,
        },
        "limits": "SNES WRAM mirrors in banks 00-3F / 80-BF were resolved. Trace covers normal DMA -> $2104 (not direct CPU OAM or HDMA). Matching snapshot is corroboration, not exclusivity. No gameplay-rule claims."
    }
    return summary


def main():
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument("--tape", type=Path, required=True)
    a.add_argument("--oam-dir", type=Path, required=True)
    a.add_argument("--output", type=Path, required=True)
    args = a.parse_args()
    try:
        result = audit(args.tape, args.oam_dir)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except (OSError, ValueError, KeyError) as ex:
        a.error(str(ex))
    print(json.dumps({k: result[k] for k in ("status", "events_dma_to_2104", "candidate_transferred_bytes", "candidate_endframe_oam_matches")}, indent=2))


if __name__ == "__main__":
    main()
