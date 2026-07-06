import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

/**
 * DEV ONLY — Reset a user's password (creates them if they don't exist yet).
 * Usage: GET /api/dev-reset-password?email=foo@bar.com&password=NewPass123!
 *
 * Remove or protect this route before going to production!
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const newPassword = searchParams.get("password") ?? "SnapSchool2026!";
  const makeSuper = searchParams.get("superadmin") !== "false"; // default: promote to superadmin

  if (!email) {
    return NextResponse.json({ error: "?email= is required" }, { status: 400 });
  }

  // Try to find existing user
  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  let userId: string;
  const existingUser = users.users.find((u) => u.email === email);

  if (existingUser) {
    // User exists — just update password + metadata
    userId = existingUser.id;

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true,
      ...(makeSuper && {
        user_metadata: {
          ...existingUser.user_metadata,
          role: "superadmin",
          status: "active",
        },
      }),
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: "updated",
      message: `Password reset for ${email}. ${makeSuper ? "Promoted to superadmin." : ""}`,
      email,
      newPassword,
      nextStep: `Sign in at http://localhost:3000/sign-in`,
    });

  } else {
    // User doesn't exist — create them
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: newPassword,
      email_confirm: true,
      user_metadata: makeSuper
        ? { role: "superadmin", status: "active" }
        : { role: "admin", status: "pending" },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    userId = created.user.id;

    return NextResponse.json({
      success: true,
      action: "created",
      message: `New user ${email} created. ${makeSuper ? "Promoted to superadmin." : ""}`,
      email,
      newPassword,
      userId,
      nextStep: `Sign in at http://localhost:3000/sign-in`,
    });
  }
}
