#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const Core=require('../forja65-core.js');
const IO=require('../tools/project-io.js');
assert.equal(Core.VERSION,'0.4.36.103-rie-crossfeed');
assert.equal(IO.isAuditedCacheVersion('0.4.36.98-rie-indexed-target-safe'),true);
assert.equal(IO.isAuditedCacheVersion('0.4.36.97-rie-indexed-trace'),true);
assert.equal(IO.isAuditedCacheVersion('0.4.36.95-rie-cfg-global','0.4.36.99-rie-observed-jsr-verified'),false);
assert.equal(IO.isAuditedCacheVersion('FAKE_VERSION'),false);
console.log('OBSERVED_JSR_CACHE_V043699_PASS v98 audited; v95 blocked');
