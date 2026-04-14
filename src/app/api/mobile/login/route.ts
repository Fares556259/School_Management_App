import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Simple mobile login — looks up a parent by email and returns their data.
// No Clerk dependency; suitable for Expo Go testing.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return new NextResponse("Email is required", { status: 400 });
    }

    const parent = await prisma.parent.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase().trim() },
          { username: email.trim() }, // The user might pass their username as the 'email' payload
          { name: { contains: email.trim(), mode: 'insensitive' } }, // Fallback to allow easy login via "Fares" during expo testing
          { surname: { contains: email.trim(), mode: 'insensitive' } }
        ]
      },
      include: {
        students: {
          include: {
            class: {
              include: {
                timetable: {
                  include: {
                    subject: true,
                    teacher: true,
                  },
                },
              },
            },
            payments: {
              orderBy: { id: "desc" },
            },
            results: {
              include: {
                exam: {
                  include: { lesson: { include: { subject: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return new NextResponse("No parent account found with that email.", { status: 404 });
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
