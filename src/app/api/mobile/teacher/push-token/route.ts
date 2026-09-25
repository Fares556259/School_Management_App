export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId } = auth.payload;

  try {
    const body = await request.json();
    const targetId = body.teacherId || body.parentId || userId;
    const pushToken = body.pushToken || null;

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
    }

    // Try finding teacher or parent
    let phone: string | null = null;
    let schoolId: string | null = null;

    const teacher = await prisma.teacher.findUnique({
      where: { id: targetId },
      select: { id: true, phone: true, schoolId: true },
    });

    if (teacher) {
      phone = teacher.phone;
      schoolId = teacher.schoolId;
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { expoPushToken: pushToken },
      });
    } else {
      const parent = await prisma.parent.findUnique({
        where: { id: targetId },
        select: { id: true, phone: true, schoolId: true },
      });
      if (parent) {
        phone = parent.phone;
        schoolId = parent.schoolId;
        await prisma.parent.update({
          where: { id: parent.id },
          data: { expoPushToken: pushToken },
        });
      }
    }

    // Cross-sync: If user has a phone, ensure ALL parent & teacher records with that phone get the token
    if (phone) {
      await Promise.all([
        prisma.teacher.updateMany({
          where: {
            phone,
            ...(schoolId ? { schoolId } : {}),
          },
          data: { expoPushToken: pushToken },
        }),
        prisma.parent.updateMany({
          where: {
            phone,
            ...(schoolId ? { schoolId } : {}),
          },
          data: { expoPushToken: pushToken },
        }),
      ]);
    }

    console.log(`[TEACHER-PUSH-TOKEN] Synchronized token for target ${targetId} (phone: ${phone || 'none'}) -> ${pushToken ? pushToken.slice(0, 22) + '...' : 'null'}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Mobile Teacher Push Token Error]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
