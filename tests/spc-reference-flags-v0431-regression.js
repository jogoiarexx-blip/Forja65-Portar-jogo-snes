'use strict';
const fs=require('node:fs'),path=require('node:path');
require('./fixtures/run_spc_probe_v0431')('spc-reference-flags-v0431',fs.readFileSync(path.join(__dirname,'spc_reference_flags_v02.cpp'),'utf8'));
