import assert from 'node:assert/strict';
import prisma from '../lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TOOLS } from '../lib/telegram/tools';
import { runMobileAgent } from '../lib/agent/mobileAgent';
import { confirmMobileAction } from '../lib/agent/mobileConfirmation';
import { prepareExpenseReversal, expenseReviewVersion } from '../lib/agent/expenseReversal';
import { buildActionCardMetadata } from '../lib/agent/actionCards';
import { sameActionArguments } from '../lib/agent/actionReview';
import { voidExpenseTool } from '../lib/telegram/tools/financeTools';

async function main() {
  const restores: (() => void)[] = [];
  const replace = (target: any, key: string, value: any) => { const old = target[key]; target[key] = value; restores.push(() => { target[key] = old; }); };
  const key = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'offline-test';
  const admin = { id: 'admin-a', schoolId: 'school-a', username: 'Test' };
  let expense: any = { id: 407, title: 'Thé', amount: 2, category: 'Restauration', date: new Date('2026-10-31T10:00:00Z') };
  let record: any; let writes = 0; let models = 0;
  const context = { adminId: admin.id, schoolId: admin.schoolId, adminName: 'Test', language: 'fr' };
  try {
    replace(prisma.admin, 'findFirst', async () => ({ ...admin, School: { name: 'Synthetic School' } }));
    replace(prisma.aIConversation, 'findFirst', async () => ({ id: 'conversation-a', title: 'Test', messages: [] }));
    replace(prisma.aIConversation, 'update', async () => ({}));
    replace(prisma.aIMessage, 'create', async ({ data }: any) => data);
    replace(prisma.expense, 'findFirst', async ({ where }: any) => { assert.equal(where.schoolId, 'school-a'); return where.id === expense?.id ? structuredClone(expense) : null; });
    replace(prisma.aIToolCall, 'create', async ({ data }: any) => { record = { id: 'proposal-a', createdAt: new Date(), ...data, conversation: { adminId: admin.id, admin, status: 'ACTIVE' } }; return record; });
    replace(prisma.aIToolCall, 'findUnique', async () => structuredClone(record));
    replace(prisma.aIToolCall, 'updateMany', async ({ where, data }: any) => { if (where.status !== record.status || (where.arguments && !sameActionArguments(record.arguments, where.arguments.equals))) return { count: 0 }; Object.assign(record, data); return { count: 1 }; });
    replace(prisma.aIToolCall, 'update', async ({ data }: any) => Object.assign(record, data));
    replace(TOOLS.void_expense, 'execute', async () => { writes++; return { success: true, message: 'Cancelled' }; });
    replace(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => { models++; throw new Error('Structured reversal does not use an LLM'); });
    const response = await runMobileAgent({ ...context, userMessage: 'Préparer l’annulation de cette dépense', prepareExpenseReversalId: 407 });
    const card = response.pendingConfirmation as any;
    assert.equal(card.actionTitle, 'Annuler une dépense'); assert.equal(card.fields[0].value, 'Thé');
    assert.equal(card.fields[1].value, '2 DT'); assert.equal(card.fields[2].value, 'Restauration'); assert.equal(card.fields[3].value, '2026-10-31');
    assert.equal(writes, 0); assert.equal(models, 0); assert.equal(record.status, 'PENDING');
    assert(!card.fields.some((field: any) => /expenseId|expectedExpenseVersion/.test(field.label)));
    const decision = (proposal: any, action: 'confirm' | 'cancel' = 'confirm') => confirmMobileAction({ ...context, toolCallId: proposal.toolCallId, action, reviewFingerprint: proposal.reviewFingerprint });
    expense.category = 'Fournitures';
    const updated: any = await decision(card);
    assert.equal(updated.actionStatus, 'PENDING'); assert.equal(writes, 0); assert.notEqual(updated.proposal.reviewFingerprint, card.reviewFingerprint);
    assert.equal((await decision(card)).actionStatus, 'PENDING'); assert.equal(writes, 0);
    assert.equal((await decision(updated.proposal)).actionStatus, 'EXECUTED'); assert.equal(writes, 1);
    await decision(updated.proposal); assert.equal(writes, 1);
    const next = await runMobileAgent({ ...context, userMessage: 'Préparer l’annulation', prepareExpenseReversalId: 407 });
    await decision(next.pendingConfirmation, 'cancel'); assert.equal((await decision(next.pendingConfirmation)).success, false); assert.equal(writes, 1);
    assert.equal(await prepareExpenseReversal({ expenseId: -1 }, context), null);
    const unavailable = await runMobileAgent({ ...context, userMessage: 'Préparer l’annulation', prepareExpenseReversalId: 999 }); assert.equal(unavailable.pendingConfirmation, null);
    const fallback = buildActionCardMetadata('old', 'void_expense', { expenseId: 407 }, 'Review'); assert.equal(fallback.actionTitle, 'Annuler une dépense'); assert(!fallback.fields.some(field => field.label === 'expenseId'));
    // The underlying delete is also guarded against changes after review, inside the transaction.
    const version = expenseReviewVersion(expense); let audits = 0;
    replace(prisma, '$transaction', async (run: any) => run({ expense: { deleteMany: async ({ where }: any) => { assert.equal(where.schoolId, 'school-a'); assert.equal(where.amount, 2); return { count: 0 }; } }, auditLog: { create: async () => { audits++; } } }));
    await assert.rejects(() => voidExpenseTool({ expenseId: 407, expectedExpenseVersion: version }, context), /changé/); assert.equal(audits, 0);
    const stale = await voidExpenseTool({ expenseId: 407, expectedExpenseVersion: 'old' }, context); assert.equal(stale.success, false);
    console.log('Expense reversal: readable stored card, no LLM/internal fields, current-school lookup, category/date version binding, re-review, cancellation, replay and atomic delete guard.');
  } finally { for (const restore of restores.reverse()) restore(); if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
