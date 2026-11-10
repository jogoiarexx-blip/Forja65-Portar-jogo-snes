"use strict";
const fs=require("node:fs"),path=require("node:path");
require("./fixtures/run_spc_probe_v0431")("dkc3-ppu-crossfeed-v04361",fs.readFileSync(path.join(__dirname,"fixtures/dkc3_ppu_crossfeed_v04361.cpp"),"utf8"));
