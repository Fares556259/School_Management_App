import prisma from '@/lib/prisma';
import type { ToolContext } from '@/lib/telegram/tools/readTools';
import { actionReviewFingerprint } from './actionReview';

export function expenseReviewVersion(expense: { id: number; title: string; amount: number; category: string; date: Date }) {
  return actionReviewFingerprint(String(expense.id), 'expense_review', { title: expense.title, amount: expense.amount, category: expense.category, date: expense.date.toISOString() });
}

export interface ExpenseReviewDisplay {
  payment?: import("./paymentActions").PaymentReview;
  beneficiary?: string;
  expense?: { title: string; amount: number; category: string; date: string };
}

/** Resolve the exact current-school expense before preparing any cancellation. No write occurs here. */
export async function prepareExpenseReversal(args: Record<string, any>, context: ToolContext) {
  const select = { id: true, title: true, amount: true, category: true, date: true };
  let expense;
  if (args.expenseId !== undefined) {
    if (!Number.isInteger(args.expenseId) || args.expenseId <= 0) return null;
    expense = await prisma.expense.findFirst({ where: { id: args.expenseId, schoolId: context.schoolId }, select });
  } else {
    if (typeof args.query !== 'string' || !args.query.trim()) return null;
    const matches = await prisma.expense.findMany({ where: { schoolId: context.schoolId, title: { contains: args.query.trim(), mode: 'insensitive' }, ...(typeof args.amount === 'number' ? { amount: args.amount } : {}) }, select, take: 2 });
    if (matches.length !== 1) return null;
    expense = matches[0];
  }
  if (!expense) return null;
  return {
    args: { expenseId: expense.id, query: expense.title, amount: expense.amount, expectedExpenseVersion: expenseReviewVersion(expense) },
    display: { expense: { title: expense.title, amount: expense.amount, category: expense.category, date: expense.date.toISOString() } } satisfies ExpenseReviewDisplay,
  };
}
