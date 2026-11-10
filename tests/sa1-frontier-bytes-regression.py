#!/usr/bin/env python3
"""A strict SA1 AOT frontier must record the bytes actually read by the CPU."""
import os,pathlib,re,subprocess,tempfile
binary=pathlib.Path(os.environ['FORJA65_FRONTIER_EXE']).resolve()
checkpoint=pathlib.Path(os.environ['FORJA65_FRONTIER_CHECKPOINT']).resolve()
inputs=pathlib.Path(os.environ['FORJA65_FRONTIER_INPUTS']).resolve()
cart=pathlib.Path(os.environ['FORJA65_FRONTIER_CART']).resolve()
with tempfile.TemporaryDirectory() as tmp:
 env=os.environ.copy();env.update(FORJA65_HEADLESS='1',FORJA65_HEADLESS_FRAMES='145000',FORJA65_INPUT_POLL=str(inputs),FORJA65_RESEARCH_CHECKPOINT_LOAD=str(checkpoint),FORJA65_SA1_MODE='strict',FORJA65_WATCHDOG_INSTRUCTIONS='0')
 result=subprocess.run([str(binary),str(cart)],cwd=tmp,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
 assert result.returncode!=0 and 'SA1 AOT missing observed PC/state or code bytes' in result.stdout, result.stdout
 trace=(pathlib.Path(tmp)/'forja65-sa1-aot-frontier.txt').read_text()
 assert re.fullmatch(r'[0-9a-f]+ state=[0-7] bytes=(?:[0-9a-f]{1,2} ){3}[0-9a-f]{1,2}\n',trace),f'frontier missing actual instruction bytes: {trace!r}'
 print('PASS SA1 frontier records PC, state and four fetched bytes')
