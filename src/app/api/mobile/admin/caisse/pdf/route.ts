import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { generateDailyCashRegisterPdf } from "@/lib/pdf/receipts";
import { uploadTelegramPhotoToStorage } from "@/lib/telegram/vision";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateMobileRequest(request);
    if (auth.error) return auth.error;

    const { userType, schoolId } = auth.payload;
    if (userType !== "admin") {
      return NextResponse.json(
        { success: false, error: "Accès réservé à la direction / administrateur." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    const schoolName = school?.name || "SnapSchool";

    const [incomesToday, expensesToday, paymentsToday] = await Promise.all([
      prisma.income.findMany({
        where: {
          schoolId,
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: "asc" },
      }),
      prisma.expense.findMany({
        where: {
          schoolId,
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: "asc" },
      }),
      prisma.payment.findMany({
        where: {
          schoolId,
          paidAt: { gte: startOfDay, lte: endOfDay },
          userType: "STUDENT",
        },
        include: {
          student: {
            select: { name: true, surname: true, class: { select: { name: true } } },
          },
        },
        orderBy: { paidAt: "asc" },
      }),
    ]);

    // Build inflow items
    const inflowItems: Array<{
      time?: string;
      label: string;
      categoryOrClass?: string;
      method?: string;
      checkDetails?: string;
      amount: number;
    }> = [];

    const recordedIncomeRefIds = new Set(
      incomesToday.map((inc) => inc.referenceId).filter(Boolean)
    );

    for (const inc of incomesToday) {
      const isCheck = inc.title.toLowerCase().includes("chèque") || inc.title.toLowerCase().includes("cheque");
      const isTransfer = inc.title.toLowerCase().includes("virement") || inc.category.toLowerCase().includes("transfer");
      const method = isCheck ? "Chèque" : isTransfer ? "Virement" : "Espèces";

      const checkMatch = inc.title.match(/ch[eè]que\s*(?:n[°o]?)?\s*([0-9a-zA-Z_-]+)/i);
      const checkDetails = checkMatch ? checkMatch[1] : undefined;

      inflowItems.push({
        time: inc.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        label: inc.title,
        categoryOrClass: inc.category,
        method,
        checkDetails,
        amount: inc.amount,
      });
    }

    for (const pmt of paymentsToday) {
      if (recordedIncomeRefIds.has(pmt.id.toString())) continue;
      const studentName = pmt.student ? `${pmt.student.name} ${pmt.student.surname}` : "Élève";
      const className = pmt.student?.class?.name || "Sans classe";
      const time = pmt.paidAt ? pmt.paidAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

      inflowItems.push({
        time,
        label: `Scolarité : ${studentName}`,
        categoryOrClass: className,
        method: "Espèces",
        amount: pmt.amount,
      });
    }

    // Build outflow items
    const outflowItems = expensesToday.map((exp) => {
      const isTransfer = exp.title.toLowerCase().includes("virement");
      const isCheck = exp.title.toLowerCase().includes("chèque") || exp.title.toLowerCase().includes("cheque");
      const method = isCheck ? "Chèque" : isTransfer ? "Virement" : "Espèces / Caisse";

      return {
        time: exp.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        label: exp.title,
        categoryOrClass: exp.category,
        method,
        amount: exp.amount,
      };
    });

    const totalIncomes = inflowItems.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = outflowItems.reduce((sum, item) => sum + item.amount, 0);
    const netBalance = totalIncomes - totalExpenses;

    const totalChecks = inflowItems
      .filter((i) => i.method === "Chèque" || Boolean(i.checkDetails))
      .reduce((sum, i) => sum + i.amount, 0);
    const checkCount = inflowItems.filter((i) => i.method === "Chèque" || Boolean(i.checkDetails)).length;

    const totalTransfers = inflowItems
      .filter((i) => i.method === "Virement")
      .reduce((sum, i) => sum + i.amount, 0);

    const totalCash = Math.max(0, totalIncomes - totalChecks - totalTransfers);

    const { buffer, filename } = await generateDailyCashRegisterPdf({
      schoolName,
      date: targetDate,
      totalIncomes,
      totalExpenses,
      netBalance,
      totalCash,
      totalChecks,
      checkCount,
      totalTransfers,
      inflowItems,
      outflowItems,
    });

    let publicUrl: string | null = null;
    try {
      publicUrl = await uploadTelegramPhotoToStorage(buffer, schoolId, "bordereau", "application/pdf");
    } catch {}

    return NextResponse.json({
      success: true,
      filename,
      pdfBase64: buffer.toString("base64"),
      pdfUrl: publicUrl || null,
      summary: {
        totalIncomes,
        totalExpenses,
        netBalance,
        totalCash,
        totalChecks,
      },
    });
  } catch (error: any) {
    console.error("[Caisse PDF API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
