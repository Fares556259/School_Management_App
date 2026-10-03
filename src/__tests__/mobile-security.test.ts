import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { generateToken, verifyToken, generateAndStoreOTP, verifyOTP } from "../lib/mobileAuth";
import { GET as promote } from "../app/api/dev-promote/route";
import { GET as upgrade } from "../app/api/upgrade-to-admin/route";

async function main() {
const originalSecret = process.env.JWT_SECRET;
try {
  delete process.env.JWT_SECRET;
  assert.throws(() => generateToken({ userId: "test", userType: "admin", schoolId: "test-school" }), /JWT_SECRET/);
  assert.equal(verifyToken(jwt.sign({ userId: "test", userType: "admin", schoolId: "test-school" }, "snapschool_mobile_jwt_super_secret_key_2026")), null);
  process.env.JWT_SECRET = "test-only-secret-with-more-than-32-characters";
  const token = generateToken({ userId: "test", userType: "admin", schoolId: "test-school" });
  assert.equal(verifyToken(token)?.schoolId, "test-school");
  assert.equal(verifyToken(jwt.sign({ userId: "test", userType: "superadmin", schoolId: "test-school" }, process.env.JWT_SECRET)), null);
  assert.equal(verifyToken(jwt.sign({ userId: "test", userType: "admin" }, process.env.JWT_SECRET)), null);
  assert.equal(verifyToken(jwt.sign({ userId: "test", userType: "admin", schoolId: "test-school" }, process.env.JWT_SECRET, { expiresIn: -1 })), null);
  const code = generateAndStoreOTP("test-phone");
  assert.equal(verifyOTP("test-phone", code), true);
  assert.equal(verifyOTP("test-phone", code), false);
  const blockedCode = generateAndStoreOTP("blocked-phone");
  for (let i = 0; i < 5; i++) assert.equal(verifyOTP("blocked-phone", "000000"), false);
  assert.equal(verifyOTP("blocked-phone", blockedCode), false);
  assert.equal((await promote()).status, 410);
  assert.equal((await upgrade()).status, 410);
  console.log("Mobile security checks passed: secret enforcement, claims, expiry, OTP single use/attempt limit, disabled privilege escalation.");
} finally {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
