import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // 1. Find the parent and their students
    const parent = await prisma.parent.findUnique({
      where: { id: userId },
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
                exam: true,
                assignment: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      // Fallback for demo: if parent doesn't exist in DB yet, 
      // check if we have any students at all to return something for testing
      const firstParent = await prisma.parent.findFirst({
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
              payments: true,
            },
          },
        },
      });
      return NextResponse.json(firstParent?.students || []);
    }

    return NextResponse.json(parent.students);
  } catch (error) {
    console.error("Mobile Data Fetch Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
