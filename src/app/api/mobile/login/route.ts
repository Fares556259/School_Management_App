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
          { username: phone.trim() },
          { name: { contains: phone.trim(), mode: 'insensitive' } } // Still allow name for easy dev-testing
        ]
      },
      include: {
        students: {
          include: {
            class: true
          }
        },
      },
    });

    if (!parent) {
      return new NextResponse("No parent account found with that phone number.", { status: 404 });
    }

    // Return parent info + their children's data
    return NextResponse.json({
      parentId: parent.id,
      name: `${parent.name} ${parent.surname}`,
      email: parent.email,
      students: parent.students,
    });
  } catch (error) {
    console.error("[Mobile Login Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
