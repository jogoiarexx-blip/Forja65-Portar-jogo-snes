'use strict';
const assert=require('node:assert/strict');
const Core=require('../forja65-core.js');
const IO=require('../tools/project-io.js');
// REV136: this test used to pin the ACTIVE core to .103, which fails by construction on every
// later release. The .103 identity is now checked on the archived .103 core, and the active
// core must still accept the audited .97/.96 caches through the chain.
const Archived=require('../crossfeed-historico/v0436103-pre-crlf/forja65-core.js');
assert.equal(Archived.VERSION,'0.4.36.103-rie-crossfeed'); // v99 preserves the opt-in .98 checks
const LINEAGE='0.4.36.117-legacy-port-archaeology';
// REV202: o decodificador de CFG mudou (tabelas inline apos JSL/JSR); a linhagem auditada termina na .117.
assert.equal(IO.isAuditedCacheVersion(Archived.VERSION),false);
assert.equal(IO.isAuditedCacheVersion(Archived.VERSION,LINEAGE),true);
assert.equal(IO.isAuditedCacheVersion(Core.VERSION),true);
assert.equal(IO.isAuditedCacheVersion('0.4.36.97-rie-indexed-trace',LINEAGE),true);
assert.equal(IO.isAuditedCacheVersion('0.4.36.96-rie-indirect-long',LINEAGE),true);
assert.equal(IO.isAuditedCacheVersion('0.4.36.95-rie-cfg-global','0.4.36.99-rie-observed-jsr-verified'),false);
assert.equal(IO.isAuditedCacheVersion('FAKE_VERSION'),false);
console.log('FORJA65_INDEXED_CACHE_V043698_PASS .97/.96 audited, .95 blocked');
