import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/mobileAuth";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const rateCheck = checkRateLimit(ip, "login");
    if (!rateCheck.success) {
      return NextResponse.json(
        { success: false, error: `Too many login attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { phone, role } = body;

    if (!phone) {
      return new NextResponse("Phone number is required", { status: 400 });
    }

    let user: any = null;
    let userType = role || "parent"; // Default to parent if role is missing

    if (userType === "parent") {
      user = await prisma.parent.findFirst({
        where: {
          OR: [
            { phone: phone.trim() },
            { username: phone.trim() }
          ]
        },
        orderBy: { id: 'asc' }
      });
    } else if (userType === "teacher") {
      user = await prisma.teacher.findFirst({
        where: {
          OR: [
            { phone: phone.trim() },
            { username: phone.trim() }
          ]
        },
        orderBy: { id: 'asc' }
      });
    }

    if (!user) {
      return new NextResponse("No account found with that phone number.", { status: 404 });
    }

    // New logic for multi-step auth - Strictly check for a valid hashed password
    const hasPassword = !!user.password && user.password.length > 10; 

    console.log(`[Mobile Login Status] Type: ${userType}, ID: ${user.id}, Name: ${user.name}, HasPasswordDetected: ${hasPassword}`);
    
    return NextResponse.json({
      success: true,
      status: hasPassword ? "NEEDS_PASSWORD" : "NEEDS_SETUP",
      userId: user.id,
      userType,
      schoolId: user.schoolId,
      name: `${user.name} ${user.surname}`,
      img: user.img,
    });
  } catch (error) {
    console.error("[Mobile Login Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
