export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, password, action, schoolId } = body;

    if (!phone || !password || !action) {
      return NextResponse.json(
        { success: false, error: "Phone, password, and action are required" },
        { status: 400 }
      );
    }

    // Resolve school — use provided schoolId, or fall back to "default_school"
    const resolvedSchoolId = schoolId || "default_school";

    let user: any = await prisma.parent.findFirst({
      where: {
        OR: [{ phone: phone.trim() }, { username: phone.trim() }],
      },
      orderBy: { id: "asc" },
      include: {
        students: {
          include: { class: true },
        },
      },
    });

    let userType = "parent";

    if (!user) {
      user = await prisma.teacher.findFirst({
        where: {
          OR: [{ phone: phone.trim() }, { username: phone.trim() }],
        },
        orderBy: { id: "asc" },
      });
      if (user) userType = "teacher";
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No account found with this number." },
        { status: 404 }
      );
    }

    if (action === "setup") {
      if (user.password) {
        return NextResponse.json(
          { success: false, error: "This account already has a password set." },
          { status: 400 }
        );
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      if (userType === "parent") {
        await prisma.parent.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });
      } else {
        await prisma.teacher.update({
          where: { id: user.id },
          data: { password: hashedPassword, activated: true },
        });
      }
    } else if (action === "signin") {
      if (!user.password) {
        return NextResponse.json(
          {
            success: false,
            error: "Password not set. Please set up your account first.",
          },
          { status: 400 }
        );
      }
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Incorrect password. Please try again." },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action request." },
        { status: 400 }
      );
    }

    // Success — return session data
    return NextResponse.json({
      success: true,
      userId: user.id,
      userType,
      schoolId: user.schoolId,
      name: `${user.name} ${user.surname}`,
      img: user.img,
      students: userType === "parent" ? user.students : [],
    });
  } catch (error: any) {
    console.error("[Mobile Auth Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
