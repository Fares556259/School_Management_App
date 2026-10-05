import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import prisma from "../lib/prisma";
import { generateToken } from "../lib/mobileAuth";
import { DELETE, GET, PATCH } from "../app/api/mobile/notifications/route";
import { POST as registerParentPushToken } from "../app/api/mobile/parent/push-token/route";

async function main() {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "notification-test-secret-with-more-than-32-characters";
  const restores: Array<() => void> = [];
  const replace = (model: any, method: string, implementation: any) => {
    const original = model[method];
    restores.push(() => { model[method] = original; });
    model[method] = implementation;
  };

  const parentToken = generateToken({ userId: "parent-a", userType: "parent", schoolId: "school-a" });
  const teacherToken = generateToken({ userId: "teacher-a", userType: "teacher", schoolId: "school-a" });
  const request = (path: string, token = parentToken, init: any = {}) => new NextRequest(`https://example.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });

  let notificationReads = 0;
  replace(prisma.notification, "findMany", async (args: any) => {
    notificationReads++;
    assert.deepEqual(args.where, { parentId: "parent-a", schoolId: "school-a" });
    return [{
      id: 7, type: "MESSAGE", title: "School update", message: "Welcome", isRead: false,
      studentId: null, createdAt: new Date("2026-10-04T08:00:00.000Z"), student: null,
    }];
  });

  let updatedWhere: any;
  replace(prisma.notification, "updateMany", async (args: any) => { updatedWhere = args.where; return { count: 1 }; });
  let deletedWhere: any;
  replace(prisma.notification, "deleteMany", async (args: any) => { deletedWhere = args.where; return { count: 1 }; });
  replace(prisma.student, "findFirst", async () => null);
  let savedPushToken: string | null | undefined;
  replace(prisma.parent, "findFirst", async (args: any) => {
    assert.deepEqual(args.where, { id: "parent-a", schoolId: "school-a" });
    return { id: "parent-a", expoPushToken: savedPushToken };
  });
  replace(prisma.parent, "update", async (args: any) => { savedPushToken = args.data.expoPushToken; return { id: "parent-a" }; });

  try {
    assert.equal((await GET(request("/api/mobile/notifications", teacherToken))).status, 403);
    assert.equal(notificationReads, 0);

    const listResponse = await GET(request("/api/mobile/notifications"));
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.headers.get("Cache-Control"), "private, no-store");
    const list = await listResponse.json();
    assert.equal(list[0].createdAt, "2026-10-04T08:00:00.000Z");
    assert.equal(list[0].student, "School");
    assert.equal(notificationReads, 1, "Inbox should load before a child is selected");

    assert.equal((await GET(request("/api/mobile/notifications?studentId=other-child"))).status, 404);

    assert.equal((await PATCH(request("/api/mobile/notifications", teacherToken, { method: "PATCH", body: JSON.stringify({ notificationIds: [7] }) }))).status, 403);
    assert.equal((await PATCH(request("/api/mobile/notifications", parentToken, { method: "PATCH", body: JSON.stringify({ notificationIds: [7, "bad"] }) }))).status, 400);
    assert.equal((await PATCH(request("/api/mobile/notifications", parentToken, { method: "PATCH", body: JSON.stringify({ notificationIds: [7] }) }))).status, 200);
    assert.deepEqual(updatedWhere, { id: { in: [7] }, parentId: "parent-a", schoolId: "school-a" });

    assert.equal((await DELETE(request("/api/mobile/notifications?id=7", teacherToken, { method: "DELETE" }))).status, 403);
    assert.equal((await DELETE(request("/api/mobile/notifications?id=7", parentToken, { method: "DELETE" }))).status, 200);
    assert.deepEqual(deletedWhere, { id: 7, parentId: "parent-a", schoolId: "school-a" });

    assert.equal((await registerParentPushToken(request("/api/mobile/parent/push-token", teacherToken, { method: "POST", body: JSON.stringify({ pushToken: "" }) }))).status, 403);
    assert.equal((await registerParentPushToken(request("/api/mobile/parent/push-token", parentToken, { method: "POST", body: JSON.stringify({ parentId: "parent-b", pushToken: "" }) }))).status, 403);
    assert.equal((await registerParentPushToken(request("/api/mobile/parent/push-token", parentToken, { method: "POST", body: JSON.stringify({ pushToken: "invalid" }) }))).status, 400);
    const firstDevice = "ExponentPushToken[first-device-token]";
    const secondDevice = "ExponentPushToken[second-device-token]";
    assert.equal((await registerParentPushToken(request("/api/mobile/parent/push-token", parentToken, { method: "POST", body: JSON.stringify({ pushToken: firstDevice }) }))).status, 200);
    assert.equal(savedPushToken, firstDevice, "The first device should remain backward-compatible as a plain token");
    assert.equal((await registerParentPushToken(request("/api/mobile/parent/push-token", parentToken, { method: "POST", body: JSON.stringify({ pushToken: secondDevice }) }))).status, 200);
    assert.deepEqual(JSON.parse(savedPushToken as string), [firstDevice, secondDevice], "A shared tester account should keep both devices");
    assert.equal((await registerParentPushToken(request("/api/mobile/parent/push-token", parentToken, { method: "POST", body: JSON.stringify({ pushToken: "" }) }))).status, 200);
    assert.equal(savedPushToken, null, "Disabling notifications should remove the saved parent token");

    console.log("Parent notification checks passed: inbox boot, timestamps, ownership, school scoping, and token removal.");
  } finally {
    restores.reverse().forEach(restore => restore());
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
