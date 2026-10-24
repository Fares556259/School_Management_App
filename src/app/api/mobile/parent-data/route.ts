import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  // This endpoint is for parents only
  if (userType !== "parent") {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const parent = await prisma.parent.findFirst({
      where: { id: userId, schoolId },
      include: {
        students: {
          where: { schoolId },
          include: {
            class: {
              include: {
                timetable: {
                  where: { schoolId, isDraft: false },
                  include: { subject: true, teacher: { select: { id: true, name: true, surname: true, img: true } } },
                },
              },
            },
            payments: { where: { schoolId }, orderBy: { id: "desc" } },
            results: { where: { schoolId }, include: { exam: true, assignment: true } },
          },
        },
      },
    });

    if (!parent) {
      return NextResponse.json([], { headers: { "Cache-Control": "private, no-store" } });
    }

    return NextResponse.json(parent.students, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("[Mobile Parent Data Error]", error);
    return new NextResponse(JSON.stringify({ error: "Unable to load family data" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
