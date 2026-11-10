'use strict';
// Prevent regressions where headless runs concatenate frame logs and corrupt
// the baseline/control comparison.
const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../forja65-core.js'),'utf8');
assert.match(src,/bool frameHashLogInitialized=false;/);
assert.match(src,/frameHashLogInitialized\?std::ios::app:std::ios::trunc/);
assert.match(src,/frameHashLogInitialized=true;out<<"frame="/);
const old='std::ofstream out(dest.empty()?"forja65-frame-hashes.txt":dest,std::ios::app)';
assert.equal(src.includes(old),false);
console.log('PASS frame-hash-session-v09-regression');
