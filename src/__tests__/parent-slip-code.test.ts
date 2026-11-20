import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { parentSlipCode } from "../lib/parentSlipCode";
async function run(){
 const secret="synthetic-secret-for-testing-only-123456789";
 const siblingA=parentSlipCode(secret,"school-a","parent-hbib");
 const siblingB=parentSlipCode(secret,"school-a","parent-hbib");
 assert.equal(siblingA,siblingB);assert.match(siblingA,/^[1-9][0-9]{7}$/);
 assert.notEqual(siblingA,parentSlipCode(secret,"school-b","parent-hbib"));
 assert.notEqual(siblingA,parentSlipCode(secret,"school-a","other-parent"));
 assert.equal(await bcrypt.compare(siblingA,await bcrypt.hash(siblingA,10)),true);
 assert.throws(()=>parentSlipCode("", "school-a","parent-hbib"));
 console.log("Parent slip codes: siblings, stable reprints, school scope and password verification passed");
}run();
