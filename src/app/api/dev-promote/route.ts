import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Missing email parameter. Use ?email=..." }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ emailAddress: [email] });

    if (users.data.length === 0) {
      return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
    }

    const user = users.data[0];

    await client.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        role: "superadmin",
        status: "active",
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${email} (ID: ${user.id}) is now a superadmin!`,
      nextSteps: "Go to http://localhost:3000/superadmin"
    });
  } catch (error: any) {
    console.error("DEV PROMOTE ERROR:", error);
    // Clerk sometimes throws an array of errors
    return NextResponse.json({ 
      error: error.message || "Unknown error", 
      details: error.errors ? error.errors : error 
    }, { status: 500 });
  }
}
