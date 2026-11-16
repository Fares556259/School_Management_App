import { NextRequest, NextResponse } from "next/server";
import { getCashRegisterAdmin, readCashRegister } from "@/lib/cashRegister";
import { roundMoney, schoolDate, schoolDayRange } from "@/lib/agent/dataAccuracy";
import { generateDailyCashRegisterPdf, type DailyCashRegisterItem } from "@/lib/pdf/receipts";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export async function GET(request: NextRequest) {
  try {
    const admin = await getCashRegisterAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403, headers });

    const today = schoolDate();
    const day = request.nextUrl.searchParams.get("date") ?? today;
    try {
      schoolDayRange(day);
      if (day > today) throw new Error("Future date");
    } catch {
      return NextResponse.json({ error: "Invalid date" }, { status: 400, headers });
    }

    const ledger = await readCashRegister(admin.schoolId, day);
    const receiptIds = [...new Set(ledger.operations.flatMap((row) =>
      row.type === "income" && row.referenceType === "StudentBillingReceipt" && row.referenceId
        ? [row.referenceId]
        : [],
    ))];
    const receipts = receiptIds.length ? await prisma.studentBillingReceipt.findMany({
      where: { schoolId: admin.schoolId, id: { in: receiptIds } },
      select: { id: true, paymentMethod: true },
    }) : [];
    const methods = new Map(receipts.map((receipt) => [receipt.id, receipt.paymentMethod]));
    const inflowItems: DailyCashRegisterItem[] = [];
    const outflowItems: DailyCashRegisterItem[] = [];

    for (const row of ledger.operations) {
      const storedMethod = row.referenceType === "StudentBillingReceipt" && row.referenceId
        ? methods.get(row.referenceId)
        : undefined;
      const legacyMethod = row.title.match(/\s[-–]\s(Esp[eè]ces|Ch[eè]que(?:\s+n[°o]\s*\S+)?|Virement|Carte)\s*$/i)?.[1];
      const methodText = storedMethod ?? legacyMethod ?? "";
      const method = /^(?:ch[eè]que)/i.test(methodText) ? "Chèque"
        : /^esp[eè]ces$/i.test(methodText) ? "Espèces"
        : /^virement$/i.test(methodText) ? "Virement"
        : /^carte$/i.test(methodText) ? "Carte"
        : "Non renseigné";
      const item = { time: clock.format(row.date), label: row.title, categoryOrClass: row.category, method, amount: row.amount };
      (row.type === "income" ? inflowItems : outflowItems).push(item);
    }

    const sumMethod = (method: string) => roundMoney(inflowItems.reduce((total, item) => total + (item.method === method ? item.amount : 0), 0));
    const { buffer } = await generateDailyCashRegisterPdf({
      schoolName: admin.School.Institution?.schoolName || admin.School.name,
      date: day,
      totalIncomes: ledger.totalIncome,
      totalExpenses: ledger.totalExpenses,
      netBalance: ledger.net,
      totalCash: sumMethod("Espèces"),
      totalChecks: sumMethod("Chèque"),
      checkCount: inflowItems.filter((item) => item.method === "Chèque").length,
      totalTransfers: sumMethod("Virement"),
      totalCards: sumMethod("Carte"),
      totalUnknownMethods: sumMethod("Non renseigné"),
      showLedgerCategories: true,
      inflowItems,
      outflowItems,
    });

    const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="Livre-de-caisse-${day}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[Web cashbook] PDF generation failed", error);
    return NextResponse.json({ error: "Unable to generate cashbook" }, { status: 500, headers });
  }
}
