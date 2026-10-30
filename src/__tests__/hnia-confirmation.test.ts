import assert from 'node:assert/strict';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../lib/prisma';
import { TOOLS } from '../lib/telegram/tools';
import { READ_ONLY_ACTIONS, requiresActionConfirmation, prepareConfirmedArguments } from '../lib/agent/actionPolicy';
import { confirmMobileAction } from '../lib/agent/mobileConfirmation';
import { runMobileAgent } from '../lib/agent/mobileAgent';
import { buildActionCardMetadata } from '../lib/agent/actionCards';
import { getAdminPushTokens } from '../lib/telegram/tools/notificationTools';
import { GET as history } from '../app/api/mobile/agent/history/route';
import { POST as confirmRoute } from '../app/api/mobile/agent/confirm/route';
import { generateToken } from '../lib/mobileAuth';
import { NextRequest } from 'next/server';

async function main() {
  const restores: (() => void)[] = [];
  const replace = (object: any, key: string, value: any) => { const old = object[key]; object[key] = value; restores.push(() => { object[key] = old; }); };
  const previousKey = process.env.GEMINI_API_KEY;
  const previousJwt = process.env.JWT_SECRET;
  process.env.GEMINI_API_KEY = 'test-no-network';
  process.env.JWT_SECRET = 'hnia-test-secret-longer-than-thirty-two-characters';
  let calls = 0; let written: any[] = []; let failHistory = false;
  const admin = { id: 'admin-a', schoolId: 'school-a', name: 'Admin', surname: 'Test', username: 'test', School: { name: 'Test School' } };
  const fresh = () => ({ id: 'proposal-a', conversationId: 'conversation-a', createdAt: new Date(), executedAt: null, status: 'PENDING', requiresConfirm: true, toolName: 'add_expense', arguments: { amount: 12.5, title: 'Paper', category: 'Fournitures' }, conversation: { adminId: 'admin-a', admin, status: 'ACTIVE' } });
  let record: any = fresh();
  const request = (extra = {}) => confirmMobileAction({ toolCallId: record.id, action: 'confirm', adminId: 'admin-a', schoolId: 'school-a', ...extra });
  replace(prisma.aIToolCall, 'findUnique', async () => structuredClone(record));
  replace(prisma.aIToolCall, 'updateMany', async ({ where, data }: any) => {
    assert.equal(where.conversation.adminId, 'admin-a'); assert.equal(where.conversation.admin.schoolId, 'school-a');
    if (record.status !== where.status) return { count: 0 };
    Object.assign(record, data); return { count: 1 };
  });
  replace(prisma.aIToolCall, 'update', async ({ data }: any) => { Object.assign(record, data); return record; });
  replace(prisma.aIMessage, 'create', async ({ data }: any) => { if (failHistory) throw new Error('History unavailable'); written.push(data); return { id: 'message', ...data }; });
  replace(TOOLS.add_expense, 'execute', async (args: any, context: any) => { calls++; assert.equal(context.schoolId, 'school-a'); return { success: true, message: 'Saved', data: args }; });
  try {
    // Every non-query tool, including newly added tools, must stop at a proposal.
    for (const [name, tool] of Object.entries(TOOLS)) {
      if (!READ_ONLY_ACTIONS.has(name)) assert.equal(tool.requiresConfirmation, true, `${name} must require explicit approval`);
      assert.equal(requiresActionConfirmation(name, tool), !READ_ONLY_ACTIONS.has(name));
    }
    assert.equal(requiresActionConfirmation('new_write_tool', { requiresConfirmation: false }), true);
    assert.equal(requiresActionConfirmation('get_students', { requiresConfirmation: false }), false);
    assert.match(buildActionCardMetadata('id', 'record_payment', { month: 9, year: 2025 }, '').fields.find(field => field.label === 'Période')!.value, /septembre 2025/);
    assert.equal(buildActionCardMetadata('id', 'send_push_notification', { target: 'class', targetName: '2A' }, '').fields[0].value, '2A');
    assert.equal(buildActionCardMetadata('id', 'mark_class_attendance', { absentStudents: ['Ahmed'], lateStudents: [{ name: 'Amira', note: '10 min' }] }, '').fields.find(field => field.label === 'Absents signalés')!.value, 'Ahmed');
    assert.equal(prepareConfirmedArguments(TOOLS.add_expense, fresh().arguments, { amount: '7,50' }).amount, 7.5);
    for (const amount of [-10, 0, NaN, Infinity, '7 DT', '1.000,50']) assert.throws(() => prepareConfirmedArguments(TOOLS.add_expense, fresh().arguments, { amount }));
    assert.throws(() => prepareConfirmedArguments(TOOLS.add_expense, fresh().arguments, { schoolId: 'school-b' }));
    assert.throws(() => prepareConfirmedArguments(TOOLS.add_expense, fresh().arguments, { arbitraryField: 'x' }));
    // Wrong admin, school, deleted conversation, read-only records, stale proposals: no write.
    for (const extra of [{ adminId: 'admin-b' }, { schoolId: 'school-b' }, { action: 'invalid' as any }]) assert.equal((await request(extra)).success, false);
    record.conversation.status = 'DELETED'; assert.equal((await request()).success, false);
    record = fresh(); record.requiresConfirm = false; assert.equal((await request()).success, false);
    record = fresh(); record.toolName = 'get_students'; assert.equal((await request()).success, false);
    record = fresh(); record.createdAt = new Date(Date.now() - 25 * 3600_000); assert.equal((await request()).actionStatus, 'EXPIRED');
    assert.equal(calls, 0);
    record = fresh(); assert.equal((await request({ action: 'cancel' })).actionStatus, 'REJECTED');
    assert.equal((await request()).success, false); assert.equal(calls, 0);
    record = fresh(); assert.equal((await request({ updatedArgs: { amount: -7 } })).success, false); assert.equal(record.status, 'PENDING'); assert.equal(calls, 0);
    // Racing taps and retries execute exactly once, returning the real terminal status.
    record = fresh(); const pair = await Promise.all([request(), request()]);
    assert.equal(calls, 1); assert.equal(record.status, 'EXECUTED');
    assert(pair.some(result => result.actionStatus === 'EXECUTED'));
    assert.equal((await request()).actionStatus, 'EXECUTED'); assert.equal(calls, 1);
    assert.equal((await request({ action: 'cancel' })).success, false); assert.equal(record.status, 'EXECUTED');
    // Business failures must not become success cards. Failed actions cannot replay.
    record = fresh(); replace(TOOLS.add_expense, 'execute', async () => { calls++; return { success: false, message: 'Invalid beneficiary' }; });
    assert.equal((await request()).actionStatus, 'FAILED'); assert.equal(record.status, 'FAILED');
    const before = calls; assert.equal((await request()).success, false); assert.equal(calls, before);
    record = fresh(); replace(TOOLS.add_expense, 'execute', async () => { calls++; return { error: true, message: 'Not found' }; });
    assert.equal((await request()).success, false); assert.equal(record.status, 'FAILED');
    // Auxiliary history errors do not mislabel a completed change as failed.
    record = fresh(); failHistory = true; replace(TOOLS.add_expense, 'execute', async () => { calls++; return { success: true, message: 'Saved' }; });
    assert.equal((await request()).actionStatus, 'EXECUTED'); assert.equal(record.status, 'EXECUTED'); failHistory = false;

    // Generation: even a batch starting with a read cannot execute any following writes.
    replace(prisma.admin, 'findFirst', async () => admin);
    replace(prisma.aIConversation, 'findFirst', async () => ({ id: 'conversation-a', title: 'Test', messages: [], status: 'ACTIVE' }));
    replace(prisma.aIConversation, 'update', async () => ({}));
    replace(prisma.aIKnowledge, 'findMany', async () => []);
    replace(prisma.class, 'findMany', async () => []);
    replace(prisma.expense, 'findFirst', async () => null);
    let staged: any[] = [];
    replace(prisma.aIToolCall, 'create', async ({ data }: any) => { const row = { id: `staged-${staged.length}`, ...data }; staged.push(row); return row; });
    replace(TOOLS.get_students, 'execute', async () => { throw new Error('Batch read must wait until write proposals are shown'); });
    replace(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({ startChat: () => ({ sendMessage: async () => ({ response: {
      functionCalls: () => [{ name: 'get_expenses', args: {} }, { name: 'add_expense', args: fresh().arguments }, { name: 'teach_hnia', args: { instruction: 'Rule' } }],
      text: () => '',
    } }) }) }));
    const beforeGeneration = calls;
    const proposal = await runMobileAgent({ adminId: 'admin-a', schoolId: 'school-a', userMessage: 'Prépare une dépense et enseigne une règle personnalisée' });
    assert.equal(proposal.success, true); assert.equal(calls, beforeGeneration);
    assert.equal(staged.length, 2); assert(staged.every(row => row.status === 'PENDING' && row.requiresConfirm));
    assert.equal((proposal.pendingConfirmation as any[]).length, 2);
    assert(written.some(message => message.toolCallId === staged[0].id));
    assert(written.some(message => message.toolCallId === staged[1].id));

    // History must return the exact completed card, never resurrect it as pending.
    replace(prisma.aIToolCall, 'findMany', async () => []);
    replace(prisma.aIConversation, 'findFirst', async () => ({ id: 'conversation-a', messages: [{ id: 'm', role: 'assistant', content: 'Please confirm', toolCallId: 'proposal-a', createdAt: new Date() }], toolCalls: [{ ...fresh(), status: 'EXECUTED', result: { message: 'Saved' } }] }));
    const token = generateToken({ userId: 'admin-a', userType: 'admin', schoolId: 'school-a' });
    const historyRes = await history(new NextRequest('https://example.com/api/mobile/agent/history?limit=invalid', { headers: { Authorization: `Bearer ${token}` } }));
    const loaded = await historyRes.json(); assert.equal(loaded.messages[0].pendingConfirmation.status, 'EXECUTED'); assert.equal(loaded.pendingConfirmations.length, 0);
    const malformed = await confirmRoute(new NextRequest('https://example.com/api/mobile/agent/confirm', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ toolCallId: {}, action: 'confirm', updatedArgs: [] }) }));
    assert.equal(malformed.status, 400);
    // Test pushes may not discover another tenant or choose an arbitrary parent.
    replace(prisma.admin, 'findFirst', async ({ where }: any) => { assert.equal(where.schoolId, 'school-a'); return { phone: '20000000' }; });
    for (const model of [prisma.parent, prisma.teacher]) replace(model, 'findFirst', async ({ where }: any) => { assert.equal(where.schoolId, 'school-a'); assert(where.OR); return null; });
    assert.deepEqual(await getAdminPushTokens({ schoolId: 'school-a', adminId: 'admin-a', adminName: 'Admin', language: 'fr' }), []);
    console.log('Hnia confirmation safeguards passed: proposals, ownership, expiry, cancellation, concurrency, business failures, history, payload validation and push isolation.');
  } finally {
    for (const restore of restores.reverse()) restore();
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
    if (previousJwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousJwt;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
