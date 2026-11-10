'use strict';
const assert=require('node:assert/strict');
const Core=require('../forja65-core.js');
const IO=require('../tools/project-io.js');
const LINEAGE='0.4.36.117-legacy-port-archaeology';
// REV202: o decodificador de CFG mudou (tabelas inline apos JSL/JSR); a linhagem auditada termina na .117.
assert.equal(IO.isAuditedCacheVersion('0.4.36.97-rie-indexed-trace'),false,'REV202 rejeita');
assert.equal(IO.isAuditedCacheVersion('0.4.36.97-rie-indexed-trace',LINEAGE),true,'v97 audited predecessor must remain available');
assert.equal(IO.isAuditedCacheVersion(Core.VERSION),true);
assert.equal(IO.isAuditedCacheVersion('0.4.36.96-rie-indirect-long',LINEAGE),true);
// The v96 generated runtime changed relative to v95, so do not silently
// authorize that older cache merely to satisfy a historical regression.
assert.equal(IO.isAuditedCacheVersion('0.4.36.95-rie-cfg-global','0.4.36.99-rie-observed-jsr-verified'),false);
assert.equal(IO.isAuditedCacheVersion('0.3.97-tetris-hardware'),false);
console.log('FORJA65_INDEXED_CACHE_VERSION_V043697_PASS compatible=.96 blocked=.95');
