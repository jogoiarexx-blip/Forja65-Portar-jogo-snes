#!/usr/bin/env python3
"""Import ROM-proven direct-call dependency closure from a Forja65 generated CFG.

Conservative boundaries: ONLY JSR/JSL call edges already decoded in the ROM,
only generated function starts, no guessed indirect targets, no substitution of
existing dispatcher owners, and never any claim of runtime equivalence.

Default: preview against a disposable copy of the port. --apply exports the
staged copy at --out/project, leaving the original project untouched.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

HEX = re.compile(r"^[0-9a-fA-F]{6}$")
DIRECT = frozenset(("JSR", "JSL"))


def dependency_closure(analysis, root, max_depth=2, max_handlers=16):
    """Return reachable direct callees, deterministic BFS, no inferred edges."""
    if max_handlers < 1 or max_depth < 0:
        raise ValueError("Invalid bounded closure limits")
    functions = {}
    for fn in analysis.get("functions", []):
        start = fn.get("start")
        if isinstance(start, int) and 0 <= start <= 0xffffff:
            functions.setdefault(start, []).append(fn)
    if root not in functions:
        raise ValueError(f"Root {root:06X} has no generated CFG function")
    pending = collections.deque([(root, 0, None)])
    seen, plan = set(), []
    while pending and len(plan) < max_handlers:
        addr, depth, parent = pending.popleft()
        if addr in seen: continue
        seen.add(addr)
        plan.append({"target": f"{addr:06X}", "depth": depth,
                     "called_from": None if parent is None else f"{parent:06X}"})
        if depth >= max_depth: continue
        outgoing = set()
        for fn in functions[addr]:
            for c in fn.get("calls", []):
                target, kind = c.get("target"), c.get("kind")
                if kind not in DIRECT or not isinstance(target,int): continue
                if 0 <= target <= 0xffffff and target in functions and target not in seen:
                    outgoing.add(target)
        for target in sorted(outgoing):
            pending.append((target, depth+1, addr))
    return plan


def generate_proof(forja, rom, generated, entry, out):
    """Verify the exact generated shard bytes against the project ROM."""
    sources = sorted(p for p in (generated/"src").glob("generated_*.cpp")
                     if f"void sub_{entry}_" in p.read_text(encoding="utf8"))
    if not sources:
        raise ValueError(f"No source shard defining entry {entry}")
    proof = out/(entry.lower()+"-rom-proof.json")
    fingerprint = json.loads((generated/"analysis.json").read_text(encoding="utf8"))["rom_fingerprint"]
    # Verifier exports its own FNV+SHA256 identity, checked by the integrator.
    if len(sources)==1:
        cmd=["node",str(forja/"tools/verify-generated-rom.js"),str(rom),
             str(sources[0]),entry,fingerprint,str(proof)]
    else:
        cmd=["node",str(forja/"tools/verify-generated-shards.js"),str(rom),
             entry,fingerprint,str(proof),*[str(p) for p in sources]]
    p=subprocess.run(cmd,capture_output=True,text=True,check=False)
    if p.returncode:
        raise ValueError("ROM proof failed: "+(p.stderr or p.stdout)[-450:])
    return proof


def stage(project, generated, rom, forja, root, out, max_depth=2, max_handlers=16, apply=False, stack_compat=False):
    if not HEX.fullmatch(root):raise ValueError("Use a six-digit ROM address")
    root_addr=int(root,16)
    if hashlib.sha256(rom.read_bytes()).digest()!=hashlib.sha256((project/"assets/cart-data.bin").read_bytes()).digest():
        raise ValueError("Project ROM differs from generated analysis ROM")
    analysis=json.loads((generated/"analysis/function-analysis.json").read_text(encoding="utf8"))
    plan=dependency_closure(analysis,root_addr,max_depth,max_handlers)
    generated_starts={f.get("start") for f in analysis.get("functions",[]) if isinstance(f.get("start"),int)}
    closure_starts={int(p["target"],16) for p in plan}
    pending_direct={}
    for fn in analysis.get("functions",[]):
        if fn.get("start") not in closure_starts:continue
        for call in fn.get("calls",[]):
            target=call.get("target")
            if call.get("kind") not in DIRECT or not isinstance(target,int) or target in generated_starts:continue
            key=(fn["start"],target,call.get("kind"))
            pending_direct[key]={"from":f"{fn['start']:06X}","target":f"{target:06X}",
                                 "kind":call["kind"],"status":"missing_in_generated_cfg"}
    out.mkdir(parents=True,exist_ok=True)
    spec=importlib.util.spec_from_file_location("forja_cfg_integrator",forja/"tools/integrate-generated-cfg.py")
    integrator=importlib.util.module_from_spec(spec);spec.loader.exec_module(integrator)
    results=[]
    with tempfile.TemporaryDirectory(prefix="forja65-cfg-closure-") as temp:
        staged=Path(temp)/"project"
        shutil.copytree(project,staged,ignore=shutil.ignore_patterns("build*",".git","__pycache__"))
        compat_added=False
        if stack_compat:
            bridge=importlib.util.spec_from_file_location("forja_stack_compat",forja/"tools/stack-runtime-compat.py")
            compat=importlib.util.module_from_spec(bridge);bridge.loader.exec_module(compat)
            compat_added=compat.install(staged/"src/runtime.hpp")
        for row in plan:
            entry=row["target"]
            try:
                proof=generate_proof(forja,rom,generated,entry,out)
                result=integrator.integrate(staged,generated,entry,proof,
                                             commit=True,preserve_existing=True)
                row.update({"status":"staged","new_sites":result["new_instruction_sites"],
                            "new_states":result["new_state_sites"],
                            "source_file":result["source_file"]})
            except (OSError,ValueError,KeyError) as exc:
                row.update({"status":"skipped","reason":str(exc)[:350]})
            results.append(row)
        accepted=sum(x["status"]=="staged" for x in results)
        report={"schema":"forja65.cfg-direct-call-closure.v1",
                "root":root.upper(),"rom_sha256":hashlib.sha256(rom.read_bytes()).hexdigest(),
                "max_depth":max_depth,"max_handlers":max_handlers,
                "direct_only":True,"staged_handlers":accepted,"total_candidates":len(plan),
                "pending_direct_calls":sorted(pending_direct.values(),key=lambda r:(r["from"],r["target"])),
                "exported":bool(apply and accepted),"runtime_stack_compat_added":compat_added,"results":results,
                "limits":["Static direct JSR/JSL closure, not runtime CFG equivalence",
                          "Indirect JMP/JSR and unresolved RTL/RTS destinations remain dynamic",
                          "Skipped existing/overlapping owners require state-aware review",
                          "No changes to the original project; compile and replay staged copy before use"]}
        if apply and accepted:
            destination=out/"project"
            if destination.exists():
                raise ValueError("Refusing to overwrite previous staged project")
            shutil.move(str(staged),str(destination))
        (out/"closure-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
        return report


def main():
    a=argparse.ArgumentParser(description=__doc__)
    for key in ("project","generated","rom","out"):
        a.add_argument("--"+key,type=Path,required=True)
    a.add_argument("--forja",type=Path,default=Path(__file__).resolve().parent.parent)
    a.add_argument("--root",required=True)
    a.add_argument("--max-depth",type=int,default=2)
    a.add_argument("--max-handlers",type=int,default=16)
    a.add_argument("--apply",action="store_true",help="Export staged project separately")
    a.add_argument("--stack-compat",action="store_true",help="Opt in to additive legacy runtime stack overloads")
    a=a.parse_args()
    try:
        result=stage(a.project.resolve(),a.generated.resolve(),a.rom.resolve(),
                     a.forja.resolve(),a.root,a.out.resolve(),a.max_depth,a.max_handlers,a.apply,a.stack_compat)
        print(json.dumps({"root":result["root"],"staged":result["staged_handlers"],
                          "candidates":result["total_candidates"],"exported":result["exported"]}))
    except (OSError, ValueError, subprocess.SubprocessError) as e:
        a.exit(2,"CFG closure rejected: "+str(e)+"\n")

if __name__=="__main__":main()
