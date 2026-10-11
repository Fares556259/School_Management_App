import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type Identifier = { nationalId?: string | null; studentId?: string };

const duplicateMessage = "Cet identifiant unique est déjà utilisé dans cette école. Veuillez en saisir un autre. / المعرّف الوحيد مستخدم بالفعل في هذه المدرسة.";

/** All application writes assigning nationalId must use this transaction.
 * A school-scoped PostgreSQL lock serializes checks and writes across server instances.
 * No schema migration or changes to existing student records are required.
 */
export async function withUniqueStudentIdentifiers<T>(
  schoolId: string,
  identifiers: Identifier[],
  write: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const values = identifiers.filter(item => item.nationalId);
  const ids = values.map(item => item.nationalId!);
  if (new Set(ids).size !== ids.length) throw new Error(duplicateMessage);

  return prisma.$transaction(async tx => {
    if (ids.length) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('student-national-id'), hashtext(${schoolId}))`;
      const existing = await tx.student.findMany({
        where: { schoolId, nationalId: { in: ids } },
        select: { id: true, nationalId: true },
      });
      const owners = new Map(values.map(item => [item.nationalId, item.studentId]));
      if (existing.some(student => owners.get(student.nationalId) !== student.id)) {
        throw new Error(duplicateMessage);
      }
    }
    return write(tx);
  }, { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 20000 });
}
