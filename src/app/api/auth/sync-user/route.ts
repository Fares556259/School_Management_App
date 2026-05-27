import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { schoolName, phoneNumber, city } = await req.json();
    if (!schoolName) {
      return new NextResponse("School Name is required", { status: 400 });
    }

    // Fetch user details from Clerk to get email/name
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;

    // PROTECTION: Do not overwrite the role if they are already a superadmin
    const currentRole = user.publicMetadata?.role as string;
    if (currentRole === "superadmin") {
      return NextResponse.json({ success: true, message: "Superadmin profile detected. Skipping sync to prevent downgrade." });
    }

    // INTEL: Check if they are already active in Clerk
    const clerkStatus = user.publicMetadata?.status as string;
    const dbAdminStatus = clerkStatus === "active" ? "active" : "pending";
    const dbLeadStatus = clerkStatus === "active" ? "ACTIVATED" : "PENDING";

    // AUTO-PROVISION if active in Clerk
    if (clerkStatus === "active") {
      const { provisionSchool } = await import("@/app/(superadmin)/superadmin/actions");
      const schoolId = user.publicMetadata?.schoolId as string || "default_school";
      await provisionSchool(userId, schoolId, schoolName);
    } else {
      // Create or Update the Admin record (Standard flow)
      await prisma.admin.upsert({
        where: { id: userId },
        update: {
          pendingSchoolName: schoolName,
          status: "pending",
          phone: phoneNumber || undefined,
        },
        create: {
          id: userId,
          username: user.username || "user_" + userId.slice(-5),
          name: user.firstName || "New",
          surname: user.lastName || "Admin",
          status: "pending",
          pendingSchoolName: schoolName,
          schoolId: "default_school",
          phone: phoneNumber || undefined,
        },
      });
    }

    // Update Clerk metadata to match (only lock to pending if not already active)
    if (clerkStatus !== "active") {
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          status: "pending",
          role: "admin",
        },
      });
    }

    // Also forcefully generate a SetupRequest to populate the Leads tab
    await prisma.setupRequest.create({
      data: {
        schoolName: schoolName,
        ownerName: `${user.firstName || "New"} ${user.lastName || "Admin"}`,
        phoneNumber: phoneNumber || "N/A",
        city: city || "Online / Sync",
        status: dbLeadStatus
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("User Sync Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
