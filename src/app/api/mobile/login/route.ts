import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Simple mobile login — looks up a parent by email and returns their data.
// No Clerk dependency; suitable for Expo Go testing.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return new NextResponse("Phone number is required", { status: 400 });
    }

    let user: any = await prisma.parent.findFirst({
      where: {
        OR: [
          { phone: phone.trim() },
          { username: phone.trim() }
        ]
      },
      orderBy: { id: 'asc' }
    });

    let userType = "parent";

    if (!user) {
      user = await prisma.teacher.findFirst({
        where: {
          OR: [
            { phone: phone.trim() },
            { username: phone.trim() }
          ]
        },
        orderBy: { id: 'asc' }
      });
      if (user) userType = "teacher";
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
