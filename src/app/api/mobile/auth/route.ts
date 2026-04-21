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

    const parent = await prisma.parent.findFirst({
      where: {
        schoolId: resolvedSchoolId,
        OR: [{ phone: phone.trim() }, { username: phone.trim() }],
      },
      orderBy: { id: "asc" },
      include: {
        students: {
          include: { class: true },
        },
      },
    });

    if (parent) {
      console.log(
        `[Mobile Auth POST] ID: ${parent.id}, Name: ${parent.name}, School: ${resolvedSchoolId}, HasPassword: ${!!parent.password}, Action: ${action}`
      );
    }

    if (!parent) {
      return NextResponse.json(
        { success: false, error: "No account found with this number." },
        { status: 404 }
      );
    }

    if (action === "setup") {
      if (parent.password) {
        return NextResponse.json(
          { success: false, error: "This account already has a password set." },
          { status: 400 }
        );
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.parent.update({
        where: { id: parent.id },
        data: { password: hashedPassword },
      });
    } else if (action === "signin") {
      if (!parent.password) {
        return NextResponse.json(
          {
            success: false,
            error: "Password not set. Please set up your account first.",
          },
          { status: 400 }
        );
      }
      const isValid = await bcrypt.compare(password, parent.password);
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

    // Success — return session data including schoolId for subsequent requests
    return NextResponse.json({
      success: true,
      parentId: parent.id,
      schoolId: resolvedSchoolId,
      name: `${parent.name} ${parent.surname}`,
      img: parent.img,
      students: parent.students,
    });
  } catch (error: any) {
    console.error("[Mobile Auth Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
