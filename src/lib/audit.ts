import prisma from "./prisma";
import { createClient } from "@/utils/supabase/server";

/**
 * Creates a record in the AuditLog table.
 * @param action - e.g. "SALARY_PAYMENT", "TUITION_RECEIPT", "GENERAL_EXPENSE"
 * @param entityType - e.g. "Teacher", "Student", "School"
 * @param entityId - The ID of the affected record (optional)
 * @param description - Human readable details, e.g. "Paid $3000 to John Doe for March 2026"
 */
export async function createAuditLog({
  action,
  entityType,
  entityId,
  description,
  amount,
  type,
  effectiveDate,
  oldValues,
  newValues,
}: {
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  amount?: number;
  type?: 'income' | 'expense';
  effectiveDate?: Date;
  oldValues?: any;
  newValues?: any;
}) {
  try {
    const supabase = createClient();
    const { data: { user: authData } } = await supabase.auth.getUser();
    const userId = authData?.id;
    // If we have a userId, use it; otherwise fallback to "system" or role if available
    const performedBy = userId || "system";
    
    await prisma.auditLog.create({
      data: {
        action,
        performedBy,
        entityType,
        entityId,
        description,
        amount,
        type,
        effectiveDate,
        oldValues,
        newValues,
      },
    });
  } catch (error) {
    console.error(`[AUDIT_ERROR] Failed to record ${action}:`, error);
  }
}
