import { supabaseAdmin } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Missing email parameter. Use ?email=..." }, { status: 400 });
  }

  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) throw error;
    
    const user = users.find(u => u.email === email);

    if (!user) {
      return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
    }

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
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
    return NextResponse.json({ 
      error: error.message || "Unknown error", 
    }, { status: 500 });
  }
}
