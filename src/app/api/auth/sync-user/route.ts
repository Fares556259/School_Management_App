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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("User Sync Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
