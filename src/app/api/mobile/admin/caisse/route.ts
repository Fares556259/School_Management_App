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
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const now = new Date();
    const activeMonth = monthParam ? Math.min(12, Math.max(1, parseInt(monthParam, 10))) : now.getMonth() + 1;
    const activeYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfMonth = new Date(activeYear, activeMonth - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(activeYear, activeMonth, 0, 23, 59, 59, 999);

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
          type: "student",
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

    // 2. Fetch Today's Incomes, Expenses, Month Aggregates, and ALL Unpaid Entities (Students, Teachers, Staff)
    const [
      todayIncomes,
      todayExpenses,
      monthIncomeAgg,
      monthExpenseAgg,
      unpaidStudentRows,
      unpaidTeacherRows,
      unpaidStaffRows,
    ] = await Promise.all([
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
      // Unpaid Students query
      prisma.$queryRaw`
        SELECT 
          s.id, s.name, s.surname, 
          p.name as "pName", p.surname as "pSurname", p.phone as "parentPhone",
          COALESCE(s."customTuition", l."tuitionFee", 450)::float as "tuitionFee",
          c.name as "className",
          pay.status as "paymentStatus", 
          COALESCE(pay.amount, 0)::float as "paidAmount", 
          COALESCE(pay."deferredAmount", 0)::float as "deferredAmount"
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
        LIMIT 100
      ` as Promise<any[]>,
      // Unpaid Teachers query
      prisma.$queryRaw`
        SELECT 
          t.id, t.name, t.surname, t.phone, 
          COALESCE(t.salary, 0)::float as "salary", 
          COALESCE(t."hourlyRate", 0)::float as "hourlyRate", 
          COALESCE(t."hoursPerMonth", 0)::float as "hoursPerMonth",
          pay.status as "paymentStatus", 
          COALESCE(pay.amount, 0)::float as "paymentAmount", 
          COALESCE(pay."deferredAmount", 0)::float as "deferredAmount", 
          COALESCE(pay."missedHours", 0)::float as "missedHours"
        FROM "Teacher" t
        LEFT JOIN "Payment" pay ON t.id = pay."teacherId" 
          AND pay.month = ${activeMonth} 
          AND pay.year = ${activeYear}
        WHERE t."schoolId" = ${schoolId} 
          AND (pay.status IS NULL OR pay.status != 'PAID')
        ORDER BY 
          CASE WHEN pay.status = 'PARTIAL' THEN 1 WHEN (pay."missedHours" IS NOT NULL AND pay."missedHours" > 0) THEN 2 ELSE 3 END,
          t.surname ASC
        LIMIT 100
      ` as Promise<any[]>,
      // Unpaid Staff query
      prisma.$queryRaw`
        SELECT 
          s.id, s.name, s.surname, s.phone, 
          COALESCE(s.salary, 0)::float as "salary", 
          s.role,
          pay.status as "paymentStatus", 
          COALESCE(pay.amount, 0)::float as "paymentAmount", 
          COALESCE(pay."deferredAmount", 0)::float as "deferredAmount", 
          COALESCE(pay."missedHours", 0)::float as "missedHours"
        FROM "Staff" s
        LEFT JOIN "Payment" pay ON s.id = pay."staffId" 
          AND pay.month = ${activeMonth} 
          AND pay.year = ${activeYear}
        WHERE s."schoolId" = ${schoolId} 
          AND (pay.status IS NULL OR pay.status != 'PAID')
        ORDER BY 
          CASE WHEN pay.status = 'PARTIAL' THEN 1 WHEN (pay."missedHours" IS NOT NULL AND pay."missedHours" > 0) THEN 2 ELSE 3 END,
          s.surname ASC
        LIMIT 100
      ` as Promise<any[]>,
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

    // 4. Process Unpaid Students (Scolarités en souffrance)
    const unpaidStudents = unpaidStudentRows.map((r) => {
      const fullFee = Number(r.tuitionFee) || 450;
      const isPartial = r.paymentStatus === "PARTIAL";
      const paidAmount = Number(r.paidAmount) || 0;

      let dueAmount = fullFee;
      if (isPartial) {
        const deferred = Number(r.deferredAmount);
        dueAmount = deferred > 0 ? deferred : Math.max(0, fullFee - paidAmount);
      } else if (r.paymentStatus === "PENDING") {
        dueAmount = Number(r.paidAmount) || fullFee;
      }

      return {
        id: r.id,
        type: "student" as const,
        name: `${r.name} ${r.surname}`,
        className: r.className || "Sans classe",
        parentName: r.pName ? `${r.pName} ${r.pSurname || ""}`.trim() : "Parent",
        parentPhone: r.parentPhone ? r.parentPhone.replace(/\s+/g, "") : "",
        fullFee,
        paidAmount,
        dueAmount,
        status: r.paymentStatus || "UNPAID",
      };
    });

    // 5. Process Unpaid Teachers (Rémunérations Enseignants)
    const unpaidTeachers = unpaidTeacherRows.map((t) => {
      const rate = Number(t.hourlyRate) || 0;
      const monthlyHours = Number(t.hoursPerMonth) || 0;
      const baseSalary = (rate > 0 && monthlyHours > 0) ? (rate * monthlyHours) : (Number(t.salary) || 3000);
      const missedHours = Number(t.missedHours) || 0;
      const deduction = missedHours * (rate > 0 ? rate : 15);
      const isAdvance = t.paymentStatus === "PARTIAL";
      const advanceAmount = isAdvance ? (Number(t.paymentAmount) || 0) : 0;

      let dueAmount = Math.max(0, baseSalary - deduction - advanceAmount);
      if (t.deferredAmount && Number(t.deferredAmount) > 0) {
        dueAmount = Number(t.deferredAmount);
      } else if (t.paymentStatus === "PENDING" && t.paymentAmount && Number(t.paymentAmount) > 0) {
        dueAmount = Number(t.paymentAmount);
      }

      return {
        id: t.id,
        type: "teacher" as const,
        name: `${t.name} ${t.surname}`,
        phone: t.phone ? t.phone.replace(/\s+/g, "") : "",
        role: "Enseignant",
        baseSalary,
        hourlyRate: rate,
        advanceAmount: advanceAmount > 0 ? advanceAmount : 0,
        missedHours: missedHours > 0 ? missedHours : 0,
        deduction: deduction > 0 ? deduction : 0,
        dueAmount,
        status: t.paymentStatus || "UNPAID",
      };
    });

    // 6. Process Unpaid Staff (Rémunérations Personnel)
    const unpaidStaff = unpaidStaffRows.map((s) => {
      const baseSalary = Number(s.salary) || 1500;
      const missedHours = Number(s.missedHours) || 0;
      const isAdvance = s.paymentStatus === "PARTIAL";
      const advanceAmount = isAdvance ? (Number(s.paymentAmount) || 0) : 0;

      let dueAmount = Math.max(0, baseSalary - advanceAmount);
      if (s.deferredAmount && Number(s.deferredAmount) > 0) {
        dueAmount = Number(s.deferredAmount);
      } else if (s.paymentStatus === "PENDING" && s.paymentAmount && Number(s.paymentAmount) > 0) {
        dueAmount = Number(s.paymentAmount);
      }

      return {
        id: s.id,
        type: "staff" as const,
        name: `${s.name} ${s.surname}`,
        phone: s.phone ? s.phone.replace(/\s+/g, "") : "",
        role: s.role || "Personnel",
        baseSalary,
        advanceAmount: advanceAmount > 0 ? advanceAmount : 0,
        missedHours: missedHours > 0 ? missedHours : 0,
        dueAmount,
        status: s.paymentStatus || "UNPAID",
      };
    });

    const unpaidStudentsCount = unpaidStudents.length;
    const unpaidStudentsTotal = unpaidStudents.reduce((acc, curr) => acc + curr.dueAmount, 0);

    const unpaidEmployees = [...unpaidTeachers, ...unpaidStaff];
    const unpaidEmployeesCount = unpaidEmployees.length;
    const unpaidEmployeesTotal = unpaidEmployees.reduce((acc, curr) => acc + curr.dueAmount, 0);

    const grandUnpaidCount = unpaidStudentsCount + unpaidEmployeesCount;
    const grandUnpaidTotal = unpaidStudentsTotal + unpaidEmployeesTotal;

    const allUnpaid = [
      ...unpaidStudents,
      ...unpaidTeachers,
      ...unpaidStaff,
    ];

    const monthNamesFr = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    const monthLabel = `${monthNamesFr[activeMonth - 1]} ${activeYear}`;

    return NextResponse.json({
      success: true,
      activeMonth,
      activeYear,
      monthLabel,
      summary: {
        todayIncome,
        todayExpense,
        todayNet,
        monthIncome,
        monthExpense,
        unpaidCount: grandUnpaidCount,
        unpaidTotal: grandUnpaidTotal,
        unpaidStudentsCount,
        unpaidStudentsTotal,
        unpaidEmployeesCount,
        unpaidEmployeesTotal,
      },
      todayTransactions,
      unpaidStudents,
      unpaidTeachers,
      unpaidStaff,
      unpaidEmployees,
      allUnpaid,
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

    const monthNamesFr = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    const monthStr = monthNamesFr[activeMonth - 1];

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

    // ── ACTION 3: Pay Teacher / Staff Salary ─────────────────────────────────
    if (action === "pay_salary") {
      const { recipientId, recipientType, amount, paymentMethod = "Espèces" } = body;

      if (!recipientId || !recipientType || !amount || Number(amount) <= 0) {
        return NextResponse.json({ success: false, error: "Bénéficiaire et montant valides requis." }, { status: 400 });
      }

      const numAmount = Number(amount);

      if (recipientType === "teacher") {
        const teacher = await prisma.teacher.findUnique({
          where: { id: recipientId, schoolId },
        });

        if (!teacher) {
          return NextResponse.json({ success: false, error: "Enseignant introuvable." }, { status: 404 });
        }

        const teacherName = `${teacher.name} ${teacher.surname}`;

        await prisma.$transaction(async (tx) => {
          const payment = await tx.payment.upsert({
            where: {
              teacherId_month_year: {
                teacherId: recipientId,
                month: activeMonth,
                year: activeYear,
              },
            },
            update: {
              status: "PAID",
              amount: numAmount,
              paidAt: now,
            },
            create: {
              teacherId: recipientId,
              amount: numAmount,
              month: activeMonth,
              year: activeYear,
              status: "PAID",
              userType: "TEACHER",
              paidAt: now,
              schoolId,
            },
          });

          await tx.expense.create({
            data: {
              title: `Salaire : ${teacherName} (${monthStr} ${activeYear}) - ${paymentMethod}`,
              amount: numAmount,
              date: now,
              category: "SALAIRE",
              schoolId,
            },
          });
        });

        return NextResponse.json({
          success: true,
          message: `✓ Salaire de ${numAmount} DT versé à ${teacherName}.`,
        });
      } else if (recipientType === "staff") {
        const staff = await prisma.staff.findUnique({
          where: { id: recipientId, schoolId },
        });

        if (!staff) {
          return NextResponse.json({ success: false, error: "Personnel introuvable." }, { status: 404 });
        }

        const staffName = `${staff.name} ${staff.surname}`;

        await prisma.$transaction(async (tx) => {
          await tx.payment.upsert({
            where: {
              staffId_month_year: {
                staffId: recipientId,
                month: activeMonth,
                year: activeYear,
              },
            },
            update: {
              status: "PAID",
              amount: numAmount,
              paidAt: now,
            },
            create: {
              staffId: recipientId,
              amount: numAmount,
              month: activeMonth,
              year: activeYear,
              status: "PAID",
              userType: "STAFF",
              paidAt: now,
              schoolId,
            },
          });

          await tx.expense.create({
            data: {
              title: `Salaire : ${staffName} (${monthStr} ${activeYear}) - ${paymentMethod}`,
              amount: numAmount,
              date: now,
              category: "SALAIRE",
              schoolId,
            },
          });
        });

        return NextResponse.json({
          success: true,
          message: `✓ Salaire de ${numAmount} DT versé à ${staffName}.`,
        });
      }
    }

    return NextResponse.json({ success: false, error: "Action non reconnue." }, { status: 400 });
  } catch (error: any) {
    console.error("[Caisse API POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
