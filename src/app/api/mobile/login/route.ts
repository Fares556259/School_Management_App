import { normalizeParentPhone, parentPhoneCandidates } from "@/lib/parentAccess";
import { checkPersistentRateLimit } from "@/lib/mobileRateLimit";
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

    const rate = await checkPersistentRateLimit(ip, 'login-lookup', 10);
    if (!rate.success) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 });
    const lookupPhone = role === 'teacher' ? phone.trim() : normalizeParentPhone(phone);
    let user: any = null;
    let userType = role || "parent"; // Default to parent if role is missing

    if (userType === "parent") {
      user = await prisma.parent.findFirst({
        where: {
          OR: parentPhoneCandidates(lookupPhone).flatMap(value => [{ phone: value }, { username: value }])
        },
        orderBy: { id: 'asc' }
      });
    } else if (userType === "teacher") {
      user = await prisma.teacher.findFirst({
        where: {
          OR: [
            { phone: lookupPhone },
            { username: lookupPhone }
          ]
        },
        orderBy: { id: 'asc' }
      });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, notFound: true, error: "No account found with that phone number." },
        { status: 404 }
      );
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

    });
  } catch (error) {
    console.error("[Mobile Login Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
