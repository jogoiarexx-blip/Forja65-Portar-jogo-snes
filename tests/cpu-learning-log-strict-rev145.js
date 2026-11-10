'use strict';
const assert=require('assert');
const L=require('../tools/learn-from-interpreter.js');
const valid=[
 '009000 M0X0 from=00800A count=1',
 '00a000 E1 from=00ffff count=9007199254740991',
 '009000 E1M0X1 from=00800A count=2',
 '  009000\tM1X1\tfrom=00800a\tcount=0  '
];
assert.strictEqual(L.parseLog(valid.join('\r\n')).length,valid.length);
const invalid=[
 '009000 M0X0 from=00800Ag count=1',
 '009000 M0X0 from=00800 count=1',
 '009000 M0X0 from=100800A count=1',
 '009000 M0X0 from=0x800A count=1',
 '009000 M0X0 from=NaN count=1',
 '009000 M0X0 from=00800A count=NaN',
 '009000 M0X0 from=00800A count=Infinity',
 '009000 M0X0 from=00800A count=-1',
 '009000 M0X0 from=00800A count=1.5',
 '009000 M0X0 from=00800A count=1e2',
 '009000 M0X0 from=00800A count=9007199254740992',
 '009000 M0X0 from=00800A count=',
 '009000 M0X0 from=00800A count=1 extra',
 '# 009000 M0X0 from=00800A count=1',
 'prefix 009000 M0X0 from=00800A count=1'
];
for(const line of invalid)assert.deepStrictEqual(L.parseLog(line),[],line);
const rows=L.parseLog([...valid,...invalid].join('\n'));
assert.strictEqual(rows.length,valid.length);
assert(rows.every(r=>Number.isSafeInteger(r.from)&&Number.isSafeInteger(r.count)&&r.count>=0));
console.log('CPU_LEARNING_STRICT_PASS: valid legacy states preserved; 15 malformed records rejected');
