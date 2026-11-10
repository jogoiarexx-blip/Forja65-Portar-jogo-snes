#!/usr/bin/env python3
"""Validate this release's complete file inventory and SHA256 digests."""
from pathlib import Path
import hashlib
import sys

root = Path(__file__).resolve().parents[1]
version = "0.4.36-dma-wram-sram"
failures = []
rows = (root / "MANIFEST.sha256").read_text(encoding="utf8").splitlines()
listed = set()
for row in rows:
    digest, name = row.split("  ", 1)
    path = root / name
    listed.add(name)
    if not path.is_file():
        failures.append(f"missing: {name}")
    elif hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        failures.append(f"sha256 mismatch: {name}")
excluded = {"MANIFEST.sha256", "SHA256SUMS.txt", "CONTENTS.sha256"}
actual = {p.relative_to(root).as_posix() for p in root.rglob("*")
          if p.is_file() and p.relative_to(root).as_posix() not in excluded}
for name in sorted(actual - listed):
    failures.append(f"unlisted: {name}")
for name in ("VERSION", "VERSION.txt"):
    if (root / name).read_text().strip() != version:
        failures.append(f"version mismatch: {name}")
if failures:
    print("\n".join(failures))
    sys.exit(1)
print(f"RELEASE_V0436_SHA256_PASS files={len(rows)} version={version}")
