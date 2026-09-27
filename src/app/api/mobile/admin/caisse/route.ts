import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateMobileRequest(request);
    if (auth.error) return auth.error;

    const { userId, userType, schoolId } = auth.payload;
    if (userType !== "admin") {
      return NextResponse.json(
        { success: false, error: "Accès réservé à la direction / administrateur." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search")?.trim().toLowerCase();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const activeMonth = now.getMonth() + 1;
    const activeYear = now.getFullYear();

    // 1. If searching for students for Quick Pay
    if (searchQuery && searchQuery.length >= 2) {
      const matchedStudents = await prisma.student.findMany({
        where: {
          schoolId,
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { surname: { contains: searchQuery, mode: "insensitive" } },
            { class: { name: { contains: searchQuery, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          name: true,
          surname: true,
          img: true,
          customTuition: true,
          class: { select: { name: true } },
          level: { select: { tuitionFee: true } },
          parent: { select: { name: true, surname: true, phone: true } },
          payments: {
            where: { month: activeMonth, year: activeYear },
            select: { status: true, amount: true, deferredAmount: true },
          },
        },
        take: 15,
      });

      const formattedSearchResults = matchedStudents.map((s) => {
        const fullFee = s.customTuition ?? s.level?.tuitionFee ?? 450;
        const currentPay = s.payments[0];
        const status = currentPay?.status || "UNPAID";
        const paidAmount = currentPay?.amount || 0;
        const dueAmount = status === "PAID" ? 0 : Math.max(0, fullFee - paidAmount);

        return {
          id: s.id,
          name: `${s.name} ${s.surname}`,
          className: s.class?.name || "Sans classe",
          parentName: s.parent ? `${s.parent.name} ${s.parent.surname}` : "Parent non renseigné",
          parentPhone: s.parent?.phone || "",
          fullFee,
          paidAmount,
          dueAmount,
          status,
        };
      });

      return NextResponse.json({ success: true, students: formattedSearchResults });
    }

    // 2. Fetch Today's Incomes and Expenses
    const [todayIncomes, todayExpenses, monthIncomeAgg, monthExpenseAgg] = await Promise.all([
      prisma.income.findMany({
        where: { schoolId, date: { gte: startOfDay, lte: endOfDay } },
        orderBy: { date: "desc" },
        take: 50,
      }),
      prisma.expense.findMany({
        where: { schoolId, date: { gte: startOfDay, lte: endOfDay } },
        orderBy: { date: "desc" },
        take: 50,
      }),
      prisma.income.aggregate({
        where: { schoolId, date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { schoolId, date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
    ]);

    const todayIncome = todayIncomes.reduce((acc, curr) => acc + curr.amount, 0);
    const todayExpense = todayExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const todayNet = todayIncome - todayExpense;

    const monthIncome = monthIncomeAgg._sum.amount || 0;
    const monthExpense = monthExpenseAgg._sum.amount || 0;

    // 3. Merged chronological timeline for today
    const todayTransactions = [
      ...todayIncomes.map((inc) => ({
        id: `inc_${inc.id}`,
        type: "IN" as const,
        title: inc.title,
        category: inc.category,
        amount: inc.amount,
        createdAt: inc.date.toISOString(),
      })),
      ...todayExpenses.map((exp) => ({
        id: `exp_${exp.id}`,
        type: "OUT" as const,
        title: exp.title,
        category: exp.category,
        amount: exp.amount,
        createdAt: exp.date.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 4. Fetch unpaid / partially paid students for this month
    const unpaidRows: any[] = await prisma.$queryRaw`
      SELECT 
        s.id, s.name, s.surname, 
        p.name as "pName", p.surname as "pSurname", p.phone as "parentPhone",
        COALESCE(s."customTuition", l."tuitionFee", 450)::float as "tuitionFee",
        c.name as "className",
        pay.status as "paymentStatus", 
        COALESCE(pay.amount, 0)::float as "paidAmount", 
        pay."deferredAmount"::float as "deferredAmount"
      FROM "Student" s
      LEFT JOIN "Level" l ON s."levelId" = l.id
      LEFT JOIN "Class" c ON s."classId" = c.id
      LEFT JOIN "Parent" p ON s."parentId" = p.id
      LEFT JOIN "Payment" pay ON s.id = pay."studentId" 
        AND pay.month = ${activeMonth} 
        AND pay.year = ${activeYear}
      WHERE s."schoolId" = ${schoolId}
        AND (pay.status IS NULL OR pay.status != 'PAID')
      ORDER BY 
        CASE WHEN pay.status = 'PARTIAL' THEN 1 ELSE 2 END,
        s.surname ASC
      LIMIT 80
    `;

    const unpaidStudents = unpaidRows.map((r) => {
      const fullFee = r.tuitionFee || 450;
      const paid = r.paidAmount || 0;
      const dueAmount = r.paymentStatus === "PARTIAL" ? Math.max(0, fullFee - paid) : fullFee;

      return {
        id: r.id,
        name: `${r.name} ${r.surname}`,
        className: r.className || "Sans classe",
        parentName: r.pName ? `${r.pName} ${r.pSurname || ""}`.trim() : "Parent",
        parentPhone: r.parentPhone ? r.parentPhone.replace(/\s+/g, "") : "",
        fullFee,
        paidAmount: paid,
        dueAmount,
        status: r.paymentStatus || "UNPAID",
      };
    });

    const unpaidCount = unpaidStudents.length;
    const unpaidTotal = unpaidStudents.reduce((acc, curr) => acc + curr.dueAmount, 0);

    const monthNamesFr = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    const monthLabel = `${monthNamesFr[now.getMonth()]} ${activeYear}`;

    return NextResponse.json({
      success: true,
      summary: {
        todayIncome,
        todayExpense,
        todayNet,
        monthIncome,
        monthExpense,
        unpaidCount,
        unpaidTotal,
      },
      todayTransactions,
      unpaidStudents,
      monthLabel,
    });
  } catch (error: any) {
    console.error("[Caisse API GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action } = body;

    const now = new Date();
    const activeMonth = body.month || (now.getMonth() + 1);
    const activeYear = body.year || now.getFullYear();

    // ── ACTION 1: Quick collect student payment ────────────────────────────────
    if (action === "collect_student") {
      const { studentId, amount, paymentMethod = "Espèces" } = body;

      if (!studentId || !amount || Number(amount) <= 0) {
        return NextResponse.json({ success: false, error: "Élève et montant valides requis." }, { status: 400 });
      }

      const numAmount = Number(amount);

      const student = await prisma.student.findUnique({
        where: { id: studentId, schoolId },
        include: { level: true },
      });

      if (!student) {
        return NextResponse.json({ success: false, error: "Élève introuvable." }, { status: 404 });
      }

      const fullFee = student.customTuition ?? student.level?.tuitionFee ?? 450;

      // Check existing payment for this month
      const existingPayment = await prisma.payment.findUnique({
        where: {
          studentId_month_year: {
            studentId,
            month: activeMonth,
            year: activeYear,
          },
        },
      });

      const previousPaid = existingPayment?.amount || 0;
      const totalNowPaid = previousPaid + numAmount;
      const isComplete = totalNowPaid >= fullFee;
      const finalStatus = isComplete ? "PAID" : "PARTIAL";
      const deferredAmount = Math.max(0, fullFee - totalNowPaid);

      const monthNamesFr = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
      ];
      const monthStr = monthNamesFr[activeMonth - 1];

      await prisma.$transaction(async (tx) => {
        // 1. Upsert payment record
        const payment = await tx.payment.upsert({
          where: {
            studentId_month_year: {
              studentId,
              month: activeMonth,
              year: activeYear,
            },
          },
          update: {
            status: finalStatus,
            amount: totalNowPaid,
            deferredAmount,
            paidAt: now,
          },
          create: {
            studentId,
            amount: totalNowPaid,
            deferredAmount,
            month: activeMonth,
            year: activeYear,
            status: finalStatus,
            userType: "STUDENT",
            paidAt: now,
            schoolId,
          },
        });

        // 2. Add income entry for cash register
        await tx.income.create({
          data: {
            title: `Scolarité : ${student.name} ${student.surname} (${monthStr} ${activeYear}) - ${paymentMethod}`,
            amount: numAmount,
            date: now,
            category: "Tuition",
            referenceType: "StudentPayment",
            referenceId: payment.id.toString(),
            schoolId,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: `✓ Encaissé ${numAmount} DT pour ${student.name} ${student.surname}.`,
        studentName: `${student.name} ${student.surname}`,
        collectedAmount: numAmount,
        finalStatus,
      });
    }

    // ── ACTION 2: Quick cash expense out ──────────────────────────────────────
    if (action === "record_expense") {
      const { title, amount, category = "Divers" } = body;

      if (!title || !amount || Number(amount) <= 0) {
        return NextResponse.json({ success: false, error: "Libellé et montant valides requis." }, { status: 400 });
      }

      const numAmount = Number(amount);

      const expense = await prisma.expense.create({
        data: {
          title: title.trim(),
          amount: numAmount,
          category: category.trim(),
          date: now,
          schoolId,
        },
      });

      return NextResponse.json({
        success: true,
        message: `✓ Dépense de ${numAmount} DT enregistrée : "${title}".`,
        expenseId: expense.id,
      });
    }

    return NextResponse.json({ success: false, error: "Action non reconnue." }, { status: 400 });
  } catch (error: any) {
    console.error("[Caisse API POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
