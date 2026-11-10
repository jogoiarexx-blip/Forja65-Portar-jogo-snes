'use strict';
const fs=require('node:fs'),path=require('node:path');
process.env.FORJA65_SPC_PROFILE='reference';
require('./fixtures/run_spc_probe_v0431')('spc-io-ram-shadow-predictor-v043685',fs.readFileSync(path.join(__dirname,'fixtures/spc_io_ram_shadow_predictor_v043685.cpp'),'utf8'));
