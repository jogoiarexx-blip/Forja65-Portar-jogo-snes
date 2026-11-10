'use strict';
const fs=require('node:fs'),path=require('node:path');
require('./fixtures/run_spc_probe_v0431')('ppu-mode7-math-v0434',fs.readFileSync(path.join(__dirname,'fixtures/mode7_math_v0434.cpp'),'utf8'));
