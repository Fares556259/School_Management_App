import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  // This endpoint is for parents only
  if (userType !== "parent") {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const parent = await prisma.parent.findUnique({
      where: { id: userId, schoolId },
      include: {
        students: {
          include: {
            class: {
              include: {
                timetable: {
                  include: { subject: true, teacher: true },
                },
              },
            },
            payments: { orderBy: { id: "desc" } },
            results: { include: { exam: true, assignment: true } },
          },
        },
      },
    });

    if (!parent) {
      return NextResponse.json([]);
    }

    return NextResponse.json(parent.students);
  } catch (error) {
    console.error("Mobile Data Fetch Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
