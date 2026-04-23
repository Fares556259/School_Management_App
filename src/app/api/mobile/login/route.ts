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

    const parent = await prisma.parent.findFirst({
      where: {
        OR: [
          { phone: phone.trim() },
          { username: phone.trim() }
        ]
      },
      orderBy: { id: 'asc' }
    });

    if (parent) {
      console.log(`[Mobile Login Status] ID: ${parent.id}, Name: ${parent.name}, HasPassword: ${!!parent.password}`);
    }

    if (!parent) {
      return new NextResponse("No parent account found with that phone number.", { status: 404 });
    }

    // New logic for multi-step auth - Strictly check for a valid hashed password
    const hasPassword = !!parent.password && parent.password.length > 10; 

    console.log(`[Mobile Login Status] ID: ${parent.id}, Name: ${parent.name}, HasPasswordDetected: ${hasPassword}, RawLen: ${parent.password?.length || 0}`);
    return NextResponse.json({
      success: true,
      status: hasPassword ? "NEEDS_PASSWORD" : "NEEDS_SETUP",
      parentId: parent.id,
      schoolId: parent.schoolId,
      name: `${parent.name} ${parent.surname}`,
      img: parent.img,
    });
  } catch (error) {
    console.error("[Mobile Login Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
