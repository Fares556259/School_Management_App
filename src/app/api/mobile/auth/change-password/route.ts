import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest, checkRateLimit } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authenticateMobileRequest(request, { allowPendingParent: true });
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  if (userType !== "parent") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
  const rateCheck = checkRateLimit(`${schoolId}:${userId}:${ip}`, "change-password");
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, error: "Trop de tentatives. Réessayez dans quelques instants." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Le nouveau mot de passe doit contenir au moins 8 caractères." },
        { status: 400 }
      );
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: "Choisissez un nouveau mot de passe différent." },
        { status: 400 }
      );
    }

    const parent = await prisma.parent.findFirst({
      where: { id: userId, schoolId },
      select: { id: true, password: true },
    });
    if (!parent?.password || !(await bcrypt.compare(currentPassword, parent.password))) {
      return NextResponse.json(
        { success: false, error: "Le mot de passe actuel est incorrect." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.parent.update({
      where: { id: userId, schoolId },
      data: { password: passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Mobile Change Password Error]", error);
    return NextResponse.json(
      { success: false, error: "Impossible de modifier le mot de passe pour le moment." },
      { status: 500 }
    );
  }
}
