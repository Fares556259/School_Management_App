import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { userId } = auth();

  if (!userId) {
    return new NextResponse(
      "You must be SIGNED IN first. Go to /sign-up to create an account, then visit this link again.",
      { status: 401 }
    );
  }

  // Get role from query param, default to "admin"
  const role = req.nextUrl.searchParams.get("role") || "admin";
  const validRoles = ["admin", "teacher", "student", "parent"];

  if (!validRoles.includes(role)) {
    return new NextResponse(
      `Invalid role "${role}". Valid roles: ${validRoles.join(", ")}`,
      { status: 400 }
    );
  }

  try {
    const client = await clerkClient();
    await client.users.updateUser(userId, {
      publicMetadata: { role },
    });

    return new NextResponse(
      `✅ Successfully set your role to "${role}"! Sign out and sign back in, then go to /${role} to see your dashboard.`,
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new NextResponse("Error updating user role", { status: 500 });
  }
}
