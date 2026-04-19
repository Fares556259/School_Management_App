"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { MONTHS } from "@/lib/dateUtils";

export type AICommand = {
  type: "MARK_PAID" | "ADD_EXPENSE" | "ADD_INCOME" | "POST_NOTICE" | "RECORD_GRADES";
  data: any;
};

export async function executeAICommand(command: AICommand) {
  console.log("🚀 [AI_COMMAND] RECV:", JSON.stringify(command));
  try {
    const rawType = command.type || "UNKNOWN";
    const type = rawType.toUpperCase().trim();

    switch (type) {
      case "RECORD_PAYMENT": // Resilience: Hallucination alias
      case "MARK_PAID": {
        const { studentId, teacherId, staffId, month, year, amount: paidAmount, deferredUntil, img } = command.data;
        console.log(`🔍 [ACTION_QUERY] RecipientID=${studentId || teacherId || staffId}, Month=${month}, Year=${year}`);
        if (!month || !year) throw new Error("Missing month/year data");
        if (!studentId && !teacherId && !staffId) throw new Error("Missing recipient ID");

        const m = parseInt(month);
        const y = parseInt(year);

        // 1. Try to find the existing pending payment
        let payment = await prisma.payment.findFirst({
          where: {
            studentId: studentId || undefined,
            teacherId: teacherId || undefined,
            staffId: staffId || undefined,
            month: m,
            year: y,
            status: "PENDING"
          },
          include: { student: true, teacher: true, staff: true }
        });

        // 2. If not found, we create a on-the-fly "PAID" record (Year-round flexibility)
        if (!payment) {
          console.log("📝 [ON_THE_FLY] No pending payment. Creating new record.");
          
          // We need the recipient name for the audit log
          let recipientName = "Unknown Recipient";
          let userType = "Unknown";
          
          if (studentId) {
            const s = await prisma.student.findUnique({ where: { id: studentId } });
            if (s) {
              recipientName = `${s.name} ${s.surname}`;
              userType = "STUDENT";
            }
          } else if (teacherId) {
            const t = await prisma.teacher.findUnique({ where: { id: teacherId } });
            if (t) {
              recipientName = `${t.name} ${t.surname}`;
              userType = "TEACHER";
            }
          } else if (staffId) {
            const s = await prisma.staff.findUnique({ where: { id: staffId } });
            if (s) {
              recipientName = `${s.name} ${s.surname}`;
              userType = "STAFF";
            }
          }

          if (recipientName === "Unknown Recipient") throw new Error("Could not find recipient in database");

          const actualPaid = paidAmount ? parseFloat(paidAmount) : 450;
          
          const newPayment = await prisma.$transaction(async (tx) => {
            const p = await tx.payment.create({
              data: {
                studentId: studentId || undefined,
                teacherId: teacherId || undefined,
                staffId: staffId || undefined,
                month: m,
                year: y,
                amount: actualPaid,
                status: "PAID",
                paidAt: new Date(),
                img: img || undefined,
                userType: userType as any
              }
            });

            const ledgerTitle = studentId ? `Tuition: ${recipientName} (${MONTHS[m - 1]} ${y})` : `Salary: ${recipientName} (${MONTHS[m - 1]} ${y})`;

            if (studentId) {
              await tx.income.create({
                data: { title: ledgerTitle, amount: actualPaid, category: "Tuition", date: new Date(), referenceType: "Payment", referenceId: p.id.toString() }
              });
            } else {
              await tx.expense.create({
                data: { title: ledgerTitle, amount: actualPaid, category: "Salary", date: new Date(), referenceType: "Payment", referenceId: p.id.toString() }
              });
            }

            await tx.auditLog.create({
              data: {
                action: "CREATE",
                performedBy: "zbiba (AI)",
                entityType: "Payment",
                entityId: p.id.toString(),
                description: `AI created on-the-fly payment record for ${recipientName} (${m}/${y})`,
                amount: actualPaid,
                type: studentId ? "income" : "expense"
              }
            });

            return p;
          });

          revalidatePath("/admin");
          return { success: true, message: `New payment record created and marked as PAID for ${recipientName} (${m}/${y}).` };
        }

        // 3. IF FOUND: Existing logic for updating pending payment
        const targetAmount = payment.amount;
        const actualPaid = paidAmount ? parseFloat(paidAmount) : targetAmount;
        const isPartial = actualPaid < targetAmount;
        const gap = targetAmount - actualPaid;

        const recipient = payment.student 
          ? `${payment.student.name} ${payment.student.surname}`
          : payment.teacher
            ? `${payment.teacher.name} ${payment.teacher.surname}`
            : payment.staff
              ? `${payment.staff.name} ${payment.staff.surname}`
              : "Unknown Recipient";

        const finalStatus = isPartial ? "PARTIAL" : "PAID";

        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id! },
            data: {
              status: finalStatus as any,
              amount: actualPaid, 
              deferredAmount: isPartial ? gap : 0,
              deferredUntil: deferredUntil ? new Date(deferredUntil) : null,
              paidAt: new Date(),
              img: img || undefined
            }
          });

          if (isPartial) {
            await tx.expense.create({
              data: {
                title: `Revenue Gap: ${recipient} (${MONTHS[m - 1]} ${y})`,
                amount: gap,
                category: "Deferred Revenue Gap",
                date: new Date()
              } as any
            });
          }

          const ledgerTitle = payment.student
            ? `Tuition: ${recipient} (${MONTHS[m - 1]} ${y})`
            : `Salary: ${recipient} (${MONTHS[m - 1]} ${y})`;

          if (payment.student) {
            await tx.income.create({
              data: { title: ledgerTitle, amount: actualPaid, category: "Tuition", date: new Date(), referenceType: "Payment", referenceId: payment.id!.toString() }
            });
          } else {
            await tx.expense.create({
              data: { title: ledgerTitle, amount: actualPaid, category: "Salary", date: new Date(), referenceType: "Payment", referenceId: payment.id!.toString() }
            });
          }

          await tx.auditLog.create({
            data: {
              action: "UPDATE",
              performedBy: "zbiba (AI)",
              entityType: "Payment",
              entityId: payment.id!.toString(),
              description: isPartial 
                ? `AI marked PARTIAL payment for ${recipient}. Paid ${actualPaid} DT, gap of ${gap} DT recorded as loss.`
                : `AI marked payment as PAID for ${recipient} (Month: ${month}, Year: ${year})`,
              oldValues: payment as any,
              amount: actualPaid,
              type: payment.student ? "income" : "expense"
            }
          });
        });
        
        revalidatePath("/admin");
        return { 
          success: true, 
          message: isPartial 
            ? `Partial payment recorded for ${recipient}. ${actualPaid} DT collected, remaining ${gap} DT logged as deferral loss.`
            : `Payment for ${recipient} (${month}/${year}) has been marked as PAID.` 
        };
      }

      case "ADD_EXPENSE": {
        const { title, amount, category, date, referenceId } = command.data;
        if (!title || !amount || !category) throw new Error("Missing expense data");

        const expense = await prisma.expense.create({
          data: {
            title,
            amount: parseFloat(amount),
            category: category || "General",
            date: date ? new Date(date) : new Date(),
            img: command.data.img || undefined,
            referenceId: referenceId || undefined
          }
        });

        await prisma.auditLog.create({
          data: {
            action: "CREATE",
            performedBy: "zbiba (AI)",
            entityType: "Expense",
            entityId: expense.id.toString(),
            description: `AI recorded new expense: ${title} (Category: ${category})`,
            newValues: expense as any,
            amount: expense.amount,
            type: "expense",
            effectiveDate: expense.date
          }
        });

        revalidatePath("/admin");
        revalidatePath("/list/expenses");
        revalidatePath("/list/incomes");
        revalidatePath("/");
        return { success: true, message: `New expense '${title}' of ${amount} DT added successfully.` };
      }

      case "ADD_INCOME": {
        const { title, amount, category, date, img } = command.data;
        if (!title || !amount || !category) throw new Error("Missing income data");

        const income = await prisma.income.create({
          data: {
            title,
            amount: parseFloat(amount),
            category: category || "General",
            date: date ? new Date(date) : new Date(),
            img: img || undefined
          }
        });

        await prisma.auditLog.create({
          data: {
            action: "CREATE",
            performedBy: "zbiba (AI)",
            entityType: "Income",
            entityId: income.id.toString(),
            description: `AI recorded new income: ${title} (Category: ${category})`,
            newValues: income as any,
            amount: income.amount,
            type: "income",
            effectiveDate: income.date
          }
        });

        revalidatePath("/admin");
        revalidatePath("/list/expenses");
        revalidatePath("/list/incomes");
        revalidatePath("/");
        return { success: true, message: `New income '${title}' of ${amount} DT added successfully.` };
      }

      case "POST_NOTICE": {
        const { title, message } = command.data;
        if (!title || !message) throw new Error("Notice title and message are required");

        const notice = await prisma.notice.create({
          data: {
            title,
            message,
            date: new Date()
          }
        });

        // Trigger notifications for parents
        import("@/lib/notifications").then(m => m.createAnnouncementNotifications(notice.id));

        await prisma.auditLog.create({
          data: {
            action: "CREATE",
            performedBy: "zbiba (AI)",
            entityType: "Notice",
            entityId: notice.id.toString(),
            description: `AI posted official notice: ${title}`,
            newValues: notice as any,
          }
        });

        revalidatePath("/admin");
        return { success: true, message: `Notice '${title}' has been posted to the board.` };
      }

      case "RECORD_GRADES": {
        const { className, subjectName, term, grades } = command.data;
        if (!className || !subjectName || !term || !grades) {
          throw new Error("Missing grade recording data (Class, Subject, Term, or Grades)");
        }

        // 1. Resolve Class
        const cls = await prisma.class.findFirst({
          where: { name: { contains: className, mode: 'insensitive' } },
        });
        if (!cls) throw new Error(`Could not find class matching "${className}"`);

        // 2. Resolve Subject
        const subject = await prisma.subject.findFirst({
          where: { name: { contains: subjectName, mode: 'insensitive' } },
        });
        if (!subject) throw new Error(`Could not find subject matching "${subjectName}"`);

        // 3. Resolve Students in that class for fuzzy matching
        const classStudents = await prisma.student.findMany({
          where: { classId: cls.id },
          select: { id: true, name: true, surname: true }
        });

        // 4. Map Grades to Student IDs
        const marksToCreate: { studentId: string; score: number }[] = [];
        const unmappedNames: string[] = [];

        for (const item of grades) {
          const student = classStudents.find(s => 
            `${s.name} ${s.surname}`.toLowerCase().includes(item.studentName.toLowerCase()) ||
            item.studentName.toLowerCase().includes(`${s.name} ${s.surname}`.toLowerCase())
          );
          
          if (student) {
            marksToCreate.push({ studentId: student.id, score: item.score });
          } else {
            unmappedNames.push(item.studentName);
          }
        }

        if (marksToCreate.length === 0) {
          throw new Error("Could not match any students from the provided list to the class roster.");
        }

        // 5. Use Idempotent Upsert for GradeSheet and Grades
        const result = await prisma.$transaction(async (tx) => {
          const sheet = await tx.gradeSheet.upsert({
            where: {
              classId_subjectId_term: {
                classId: cls.id,
                subjectId: subject.id,
                term: parseInt(term)
              }
            },
            update: {
              proofUrl: command.data.img || "AI_CHAT_UPLOAD",
              notes: "AI_PROCESSED",
              updatedAt: new Date()
            },
            create: {
              classId: cls.id,
              subjectId: subject.id,
              term: parseInt(term),
              proofUrl: command.data.img || "AI_CHAT_UPLOAD",
              notes: "AI_PROCESSED"
            }
          });

          // Sequential upserts for each grade to handle the unique constraint on (studentId, subjectId, term)
          for (const m of marksToCreate) {
             await tx.grade.upsert({
                where: {
                  studentId_subjectId_term: {
                    studentId: m.studentId,
                    subjectId: subject.id,
                    term: parseInt(term)
                  }
                },
                update: {
                  score: m.score,
                  sheetId: sheet.id,
                  updatedAt: new Date()
                },
                create: {
                  studentId: m.studentId,
                  subjectId: subject.id,
                  term: parseInt(term),
                  score: m.score,
                  sheetId: sheet.id
                }
             });
          }

          await tx.auditLog.create({
            data: {
              action: "UPDATE",
              performedBy: "zbiba (AI)",
              entityType: "GradeSheet",
              entityId: sheet.id.toString(),
              description: `AI recorded/updated grade sheet for ${cls.name} - ${subject.name} (Term: ${term}, ${marksToCreate.length} students)`,
              newValues: { ...sheet, marksCount: marksToCreate.length } as any
            }
          });

          return sheet;
        });

        revalidatePath("/admin/grades");
        revalidatePath("/list/results");

        return { 
          success: true, 
          message: `Successfully recorded grades for ${cls.name} (${subject.name}). ${marksToCreate.length} marks saved. ${unmappedNames.length > 0 ? `Unmatched: ${unmappedNames.join(", ")}` : ""}` 
        };
      }

      default:
        console.error(`❌ [AI_COMMAND] UNSUPPORTED_TYPE: "${type}"`, command);
        throw new Error(`Unsupported AI command type: "${type}"`);
    }
  } catch (error: any) {
    console.error("AI Command Execution Error:", error);
    return { success: false, error: error.message || "Command failed" };
  }
}
