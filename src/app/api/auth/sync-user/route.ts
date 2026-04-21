import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { schoolName } = await req.json();
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

    // Create the Admin record in our DB with status 'pending'
    // We link them to 'default_school' placeholder for now
    await prisma.admin.upsert({
      where: { id: userId },
      update: {
        pendingSchoolName: schoolName,
        status: "pending",
      },
      create: {
        id: userId,
        username: user.username || email.split("@")[0] || "user_" + userId.slice(-5),
        email: email,
        name: user.firstName || "New",
        surname: user.lastName || "Admin",
        status: "pending",
        pendingSchoolName: schoolName,
        schoolId: "default_school",
      },
    });

    // Update Clerk metadata to match
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        status: "pending",
        role: "admin",
      },
    });

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
          phoneNumber: "N/A",
          email: email || "no-email",
          city: "Online / Sync",
          status: "PENDING"
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("User Sync Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
