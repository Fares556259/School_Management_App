import prisma from "./prisma";
import { auth } from "@clerk/nextjs/server";

/**
 * Creates a record in the AuditLog table.
 * @param action - e.g. "SALARY_PAYMENT", "TUITION_RECEIPT", "GENERAL_EXPENSE"
 * @param entityType - e.g. "Teacher", "Student", "School"
 * @param entityId - The ID of the affected record (optional)
 * @param description - Human readable details, e.g. "Paid $3000 to John Doe for March 2026"
 */
export async function createAuditLog(
  action: string,
  entityType: string,
  entityId: string | null,
  description: string
) {
  try {
    const { sessionClaims } = auth();
    const performedBy = (sessionClaims?.metadata as any)?.role || "admin";
    
    await prisma.auditLog.create({
      data: {
        action,
        performedBy,
        entityType,
        entityId,
        description,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw error to avoid breaking the main transaction, 
    // unless auditing is mission-critical.
  }
}
