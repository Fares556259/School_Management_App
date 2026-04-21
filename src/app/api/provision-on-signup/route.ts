import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import slugify from "slugify";

export const dynamic = "force-dynamic";

/**
 * POST /api/provision-on-signup
 * Called by the admin dashboard's onboarding flow (not a public webhook).
 * Auto-provisions a school for a newly signed-up user whose email matches
 * an ACTIVATED setup request.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // 1. Get user details from Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!primaryEmail) {
      return NextResponse.json({ error: "No primary email found." }, { status: 400 });
    }

    // 2. Find a matching ACTIVATED setup request
    const setupRequest = await prisma.setupRequest.findFirst({
      where: {
        email: primaryEmail,
        status: "ACTIVATED",
      },
    });

    if (!setupRequest) {
      // Not an activated user — redirect them to pending page
      return NextResponse.json({ status: "pending", message: "No activated request found." }, { status: 200 });
    }

    // 3. Check if school already exists (idempotent)
    let baseSlug = slugify(setupRequest.schoolName, { lower: true, strict: true });
    let schoolId = baseSlug;
    let counter = 1;
    while (await prisma.institution.findFirst({ where: { schoolId } })) {
      schoolId = `${baseSlug}-${counter}`;
      counter++;
    }

    // 4. Build the School Infrastructure
    await prisma.$transaction(async (tx) => {
      // Create School
      await tx.school.upsert({
        where: { id: schoolId },
        update: {},
        create: {
          id: schoolId,
          name: setupRequest.schoolName,
          subdomain: schoolId,
          updatedAt: new Date(),
        },
      });

      // Create Institution settings
      await tx.institution.create({
        data: {
          schoolId,
          schoolName: setupRequest.schoolName,
          ministryName: "Ministry of Education",
          academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          currentSemester: 1,
          yearStart: new Date(`${new Date().getFullYear()}-09-01`),
          yearEnd: new Date(`${new Date().getFullYear() + 1}-06-30`),
          holidays: [],
          sessions: [],
        },
      });

      // Create Admin record
      await tx.admin.create({
        data: {
          id: userId,
          username: primaryEmail.split("@")[0],
          email: primaryEmail,
          name: setupRequest.ownerName.split(" ")[0] || "Admin",
          surname: setupRequest.ownerName.split(" ").slice(1).join(" ") || "",
          schoolId,
        },
      });

      // Create default grade levels
      for (const level of [1, 2, 3, 4, 5, 6]) {
        await tx.level.create({
          data: { level, tuitionFee: 0, schoolId },
        });
      }

      // Mark setup request as PROVISIONED
      await tx.setupRequest.update({
        where: { id: setupRequest.id },
        data: { status: "PROVISIONED" },
      });
    });

    // 5. Set Clerk metadata so the user gets admin role
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: "admin",
        schoolId,
      },
    });

    return NextResponse.json({ status: "provisioned", schoolId }, { status: 200 });
  } catch (error: any) {
    console.error("[provision-on-signup] Error:", error);
    return NextResponse.json({ error: error.message || "Provisioning failed." }, { status: 500 });
  }
}
