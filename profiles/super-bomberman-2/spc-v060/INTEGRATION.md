# Using the archived game profile

`observed/route-*.json` are the eleven actual reference execution profiles. `compiled-pairs.json` is their resulting generated map, not training input. `routes/` and `training-provenance.json` preserve the collection evidence and hashes.

The accompanying README and provenance preserve paths from the exported game's source package. From this Forja root, generate for that compatible exported project with:

```sh
python3 tools/spc-aot/generate.py --port /path/to/exported-project \
  profiles/super-bomberman-2/spc-v060/observed/route-*.json
```

The tool requires the legacy preciseSpcTiming runtime shape documented in `tools/spc-aot/README.md`. The modern Forja runtime needs separate integration and validation. These commercial game observations do not modify the generic empty default profile or establish coverage for other games.
