import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { authenticateMobileRequest, generateToken, verifyToken, generateAndStoreOTP, verifyOTP, generateStudentClaimToken, verifyStudentClaimToken, generateMobilePrintToken, verifyMobilePrintToken } from "../lib/mobileAuth";
import { GET as promote } from "../app/api/dev-promote/route";
import { GET as upgrade } from "../app/api/upgrade-to-admin/route";
import { POST as verifyStudent } from "../app/api/mobile/student/verify/route";
import { POST as mobileAuth } from "../app/api/mobile/auth/route";
import { POST as linkStudent } from "../app/api/mobile/students/route";
import { getStudentLinkDisposition, normalizeDateOnly } from "../lib/mobileStudentLink";

async function main() {
const originalSecret = process.env.JWT_SECRET;
const originalAdminFind = prisma.admin.findFirst;
(prisma.admin as any).findFirst = async () => ({id:"test"});
try {
  delete process.env.JWT_SECRET;
  assert.throws(() => generateToken({ userId: "test", userType: "admin", schoolId: "test-school" }), /JWT_SECRET/);
  assert.equal(verifyToken(jwt.sign({ userId: "test", userType: "admin", schoolId: "test-school" }, "snapschool_mobile_jwt_super_secret_key_2026")), null);
  process.env.JWT_SECRET = "test-only-secret-with-more-than-32-characters";
  const token = generateToken({ userId: "test", userType: "admin", schoolId: "test-school" });
  assert.equal(verifyToken(token)?.schoolId, "test-school");
  assert.equal((await authenticateMobileRequest(new Request(`http://localhost/private?token=${token}`))).error?.status, 401);
  assert.equal((await authenticateMobileRequest(new Request(`http://localhost/print?token=${token}`))).error?.status, 401);
  assert.equal(verifyToken(jwt.sign({ userId: "test", userType: "superadmin", schoolId: "test-school" }, process.env.JWT_SECRET)), null);
  assert.equal(verifyToken(jwt.sign({ userId: "test", userType: "admin" }, process.env.JWT_SECRET)), null);
  assert.equal(verifyToken(jwt.sign({ userId: "test", userType: "admin", schoolId: "test-school" }, process.env.JWT_SECRET, { expiresIn: -1 })), null);
  const claimToken = generateStudentClaimToken("student-a", "school-a");
  assert.deepEqual(
    { studentId: verifyStudentClaimToken(claimToken)?.studentId, schoolId: verifyStudentClaimToken(claimToken)?.schoolId },
    { studentId: "student-a", schoolId: "school-a" }
  );
  assert.equal(verifyStudentClaimToken(`${claimToken}broken`), null);
  const printToken = generateMobilePrintToken("test", "test-school");
  assert.deepEqual(
    { userId: verifyMobilePrintToken(printToken)?.userId, schoolId: verifyMobilePrintToken(printToken)?.schoolId },
    { userId: "test", schoolId: "test-school" }
  );
  assert.equal(verifyMobilePrintToken(token), null);
  const code = generateAndStoreOTP("test-phone");
  assert.equal(verifyOTP("test-phone", code), true);
  assert.equal(verifyOTP("test-phone", code), false);
  const blockedCode = generateAndStoreOTP("blocked-phone");
  for (let i = 0; i < 5; i++) assert.equal(verifyOTP("blocked-phone", "000000"), false);
  assert.equal(verifyOTP("blocked-phone", blockedCode), false);
  assert.equal((await promote()).status, 410);
  assert.equal((await upgrade()).status, 410);
  assert.equal((await verifyStudent(new Request("http://localhost/api/mobile/student/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: "" }),
  }) as any)).status, 400);
  assert.equal(
    (
      await mobileAuth(
        new Request("http://localhost/api/mobile/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "20000000", action: "signup", role: "parent" }),
        }) as any
      )
    ).status,
    400
  );
  assert.equal(
    (
      await linkStudent(
        new Request("http://localhost/api/mobile/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: "student", birthday: "2012-05-15" }),
        }) as any
      )
    ).status,
    401
  );
  assert.equal(getStudentLinkDisposition(null, "parent-a"), "unlinked");
  assert.equal(getStudentLinkDisposition("parent-a", "parent-a"), "same-parent");
  assert.equal(getStudentLinkDisposition("parent-b", "parent-a"), "other-parent");
  assert.equal(normalizeDateOnly("2012-05-15"), "2012-05-15");
  assert.equal(normalizeDateOnly("2012-02-31"), null);
  console.log("Mobile security checks passed: secret enforcement, claims, expiry, OTP controls, secure registration, authenticated linking, ownership rules, and date validation.");
} finally {
  prisma.admin.findFirst = originalAdminFind;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
