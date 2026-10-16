import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        schoolId: true,
        parentId: true,
        customTuition: true,
        level: { select: { tuitionFee: true } },
      },
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    if (userType === "parent" && student.parentId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    if (student.schoolId !== schoolId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const [payments, institution] = await Promise.all([
      prisma.payment.findMany({
        where: { studentId, schoolId },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      }),
      prisma.institution.findFirst({
        where: { schoolId },
        select: { academicYear: true },
      }),
    ]);

    const tuitionFee = student.customTuition ?? student.level?.tuitionFee ?? 450;

    const formattedPayments = payments.map(p => ({
      id: p.id.toString(),
      month: p.month,
      year: p.year,
      amount: p.amount,
      status: p.status,
      dueDate: `${p.year}-${String(p.month).padStart(2, '0')}-01`,
      paidDate: p.paidAt ? p.paidAt.toISOString().split('T')[0] : null
    }));

    // Keep the response as an array for older mobile builds. They ignore this
    // metadata row, while current builds use it as the authoritative school data.
    return NextResponse.json([
      {
        kind: "metadata",
        tuitionFee,
        academicYear: institution?.academicYear || null,
      },
      ...formattedPayments,
    ], { headers: { "Cache-Control": "private, no-store" } });

  } catch (error) {
    console.error("Error fetching mobile payments:", error);
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
