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

    // Handle email collision: If another admin exists with this email but a different ID, delete it
    const existingAdminByEmail = await prisma.admin.findUnique({
      where: { email: email }
    });

    if (existingAdminByEmail && existingAdminByEmail.id !== userId) {
      await prisma.admin.delete({ where: { email: email } });
    }

    // INTEL: Check if they are already active in Clerk
    const clerkStatus = user.publicMetadata?.status as string;
    const dbAdminStatus = clerkStatus === "active" ? "active" : "pending";
    const dbLeadStatus = clerkStatus === "active" ? "ACTIVATED" : "PENDING";

    // AUTO-PROVISION if active in Clerk
    if (clerkStatus === "active") {
      const { provisionSchool } = await import("@/app/(superadmin)/superadmin/actions");
      const schoolId = user.publicMetadata?.schoolId as string || "default_school";
      await provisionSchool(userId, schoolId, schoolName, email);
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
          username: user.username || email?.split("@")[0] || "user_" + userId.slice(-5),
          email: email || "no-email",
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
    // We check if one already exists for this email to prevent spamming the dashboard on refresh
    const existingRequest = await prisma.setupRequest.findFirst({
      where: { email: email }
    });

    if (!existingRequest) {
      await prisma.setupRequest.create({
        data: {
          schoolName: schoolName,
          ownerName: `${user.firstName || "New"} ${user.lastName || "Admin"}`,
          phoneNumber: phoneNumber || "N/A",
          email: email || "no-email",
          city: city || "Online / Sync",
          status: dbLeadStatus
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("User Sync Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
