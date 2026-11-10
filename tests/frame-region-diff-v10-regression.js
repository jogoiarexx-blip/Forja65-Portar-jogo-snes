#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {ppm,compare}=require('../tools/frame-region-diff.js');
const image=(w,h,p)=>ppm(Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`),Buffer.from(p)]));
const a=image(2,2,[0,0,0,0,0,0,0,0,0,0,0,0]);
const b=image(2,2,[0,0,0,200,0,0,0,0,0,0,0,0]);
assert.equal(compare(a,b).changed_pixels,1);
assert.deepEqual(compare(a,b).changed_bbox,{x_min:1,y_min:0,x_max:1,y_max:0});
assert.equal(compare(a,b).changed_percent,25);
assert.equal(compare(a,a).changed_pixels,0);
assert.equal(compare(a,b,{threshold:200}).changed_pixels,0);
assert.equal(compare(a,b,{gridX:2,gridY:2}).grid[0][1].changed,1);
assert.throws(()=>ppm(Buffer.from('P6\n2 1\n255\n\x00')),/Unexpected PPM byte count/);
assert.throws(()=>ppm(Buffer.from('P3\n1 1\n255\n0 0 0')),/Expected binary/);
assert.throws(()=>compare(a,image(1,1,[0,0,0])),/Different frame/);
console.log('PASS frame-region-diff v0.10 regression (8 cases)');
