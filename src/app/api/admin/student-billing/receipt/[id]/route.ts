import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentAdminSchool } from "@/lib/studentProfile";
import { renderStudentBillingReceiptPdf } from "@/lib/pdf/studentBillingReceipt";

export const dynamic = "force-dynamic";

type Allocation = { monthYear?: string; id?: string; amount: number };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let schoolId: string;
  try {
    schoolId = await getStudentAdminSchool();
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const receipt = await prisma.studentBillingReceipt.findFirst({
      where: { id, schoolId },
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            class: { select: { name: true } },
            parent: {
              select: {
                name: true,
                surname: true,
                phone: true,
                address: true,
                schoolId: true,
              },
            },
          },
        },
      },
    });
    if (!receipt)
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

    const school = await prisma.institution.findUnique({
      where: { schoolId },
      select: { schoolName: true, address: true, phone: true },
    });
    const allocations = receipt.allocations as {
      tuition?: Allocation[];
      charges?: Allocation[];
    };
    const tuition = Array.isArray(allocations.tuition)
      ? allocations.tuition
      : [];
    const selectedCharges = Array.isArray(allocations.charges)
      ? allocations.charges
      : [];
    const chargeIds = selectedCharges
      .map((item) => item.id)
      .filter((value): value is string => !!value);
    const [charges, categories] = await Promise.all([
      prisma.studentCharge.findMany({
        where: {
          id: { in: chargeIds },
          schoolId,
          studentId: receipt.studentId,
        },
        select: { id: true, kind: true, period: true },
      }),
      prisma.studentChargeCategory.findMany({
        where: { schoolId },
        select: { kind: true, name: true },
      }),
    ]);
    const chargesById = new Map(charges.map((charge) => [charge.id, charge]));
    const categoryNames = new Map(
      categories.map((category) => [category.kind, category.name]),
    );
    const lines = [
      ...tuition.map((item) => ({
        label: `Scolarité · ${item.monthYear || ""}`,
        amount: item.amount,
      })),
      ...selectedCharges.map((item) => {
        const charge = item.id ? chargesById.get(item.id) : null;
        const label =
          charge?.kind === "REGISTRATION"
            ? "Inscription"
            : charge?.kind === "GARDE"
              ? "Garde"
              : charge?.kind === "TRANSPORT"
                ? "Transport"
                : categoryNames.get(charge?.kind || "") || "Service";
        return {
          label: `${label} · ${charge?.period || ""}`,
          amount: item.amount,
        };
      }),
    ].filter((line) => Number.isFinite(line.amount) && line.amount > 0);

    const { pdf, filename } = await renderStudentBillingReceiptPdf({
      school,
      student: {
        ...receipt.student,
        parent:
          receipt.student.parent?.schoolId === schoolId
            ? receipt.student.parent
            : null,
      },
      receipt,
      lines,
    });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Receipt unavailable" }, { status: 500 });
  }
}
