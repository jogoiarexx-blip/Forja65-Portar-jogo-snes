'use strict';
const F=require('../../forja65-core');
// RESET has no caller. End the boot smoke program with STP, retaining its CPU operations.
module.exports=()=>{const data=F.makeSyntheticRom();data[14]=0xDB;return data;};
