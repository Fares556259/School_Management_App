import assert from 'node:assert/strict';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../src/lib/prisma';
import { TOOLS } from '../src/lib/telegram/tools';
import { runMobileAgent } from '../src/lib/agent/mobileAgent';
import { confirmMobileAction } from '../src/lib/agent/mobileConfirmation';
import { READ_ONLY_ACTIONS } from '../src/lib/agent/actionPolicy';
import { actionReviewFingerprint, sameActionArguments } from '../src/lib/agent/actionReview';

/** Repeatable routing/execution benchmark. All records and model replies are synthetic. */
async function main() {
  const restore: (() => void)[] = [];
  const replace = (target: any, key: string, value: any) => { const old = target[key]; target[key] = value; restore.push(() => { target[key] = old; }); };
  const env = { key: process.env.GEMINI_API_KEY, storage: process.env.NEXT_PUBLIC_SUPABASE_URL };
  process.env.GEMINI_API_KEY = 'offline-synthetic-benchmark'; delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  const admin = { id: 'bench-admin', schoolId: 'bench-school', name: 'Test', surname: 'Admin', School: { name: 'Synthetic School' } };
  const context = { adminId: admin.id, schoolId: admin.schoolId, conversationId: 'bench-conversation' };
  const records = new Map<string, any>(); let writes = 0; let readNames: string[] = [];
  const results: { name: string; group: string; passed: boolean; error?: string }[] = [];
  let injectedCall: any = null;
  const check = async (group: string, name: string, run: () => Promise<void>) => {
    try { await run(); results.push({ group, name, passed: true }); }
    catch (error: any) { results.push({ group, name, passed: false, error: error.message }); }
  };
  const draft = async (message: string, image = false) => runMobileAgent({ ...context, userMessage: message, ...(image ? { imageBase64: 'c3ludGhldGlj' } : {}) });
  const decision = (card: any, extra: any = {}) => confirmMobileAction({ ...context, toolCallId: card.toolCallId, action: 'confirm', reviewFingerprint: card.reviewFingerprint, ...extra });
  try {
    replace(prisma.admin, 'findFirst', async () => admin);
    replace(prisma.aIConversation, 'findFirst', async () => ({ id: context.conversationId, title: 'Synthetic benchmark', messages: [{ role: 'user', content: 'Effectifs école' }, { role: 'assistant', content: '511 élèves, ancienne dépense de 300 DT' }] }));
    replace(prisma.aIConversation, 'update', async () => ({}));
    replace(prisma.aIMessage, 'create', async ({ data }: any) => ({ id: 'message', ...data }));
    replace(prisma.class, 'findMany', async () => []);
    replace(prisma.expense, 'findFirst', async () => null);
    replace(prisma.aIKnowledge, 'findMany', async ({ where }: any) => {
      assert.equal(where.schoolId, admin.schoolId); assert.equal(where.isActive, true);
      return [{ id: 'policy', schoolId: admin.schoolId, category: 'RULES', instruction: 'Les frais d’inscription sont non remboursables après la rentrée.', updatedAt: new Date('2026-10-31T08:00:00Z') }];
    });
    replace(prisma.aIToolCall, 'create', async ({ data }: any) => {
      const record = { id: `proposal-${records.size}`, createdAt: new Date(), ...data, conversation: { adminId: admin.id, admin, status: 'ACTIVE' } };
      records.set(record.id, record); return record;
    });
    replace(prisma.aIToolCall, 'findUnique', async ({ where }: any) => structuredClone(records.get(where.id)));
    replace(prisma.aIToolCall, 'findFirst', async () => ({ id: 'previous-read', toolName: 'get_students', arguments: { className: '1A' }, result: { hasMore: false } }));
    replace(prisma.aIToolCall, 'updateMany', async ({ where, data }: any) => {
      const record = records.get(where.id);
      if (!record || record.status !== where.status || (where.arguments && !sameActionArguments(record.arguments, where.arguments.equals))) return { count: 0 };
      Object.assign(record, data); return { count: 1 };
    });
    replace(prisma.aIToolCall, 'update', async ({ where, data }: any) => Object.assign(records.get(where.id), data));
    for (const [name, tool] of Object.entries(TOOLS)) {
      if (!READ_ONLY_ACTIONS.has(name)) replace(tool, 'execute', async () => { writes++; return { success: true, message: 'Synthetic execution only', data: { expenseId: 1 } }; });
    }
    for (const name of ['get_students', 'get_daily_caisse', 'get_payments', 'get_attendance', 'get_school_stats']) {
      replace(TOOLS[name], 'execute', async (args: any, scope: any) => {
        assert.equal(scope.schoolId, admin.schoolId); readNames.push(name);
        return { success: true, total: 2, students: [], records: [], hasMore: false, formattedText: `Synthetic records: ${name}`, filters: args };
      });
    }
    replace(GoogleGenerativeAI.prototype, 'getGenerativeModel', (options: any) => options.generationConfig?.responseMimeType === 'application/json'
      ? { generateContent: async () => ({ response: { text: () => JSON.stringify({ documentType: 'GENERAL', title: 'Ordinateur portable', amount: 300, summary: 'Synthetic object photo' }) } }) }
      : { startChat: () => ({ sendMessage: async () => ({ response: { functionCalls: () => injectedCall ? [injectedCall] : [], text: () => 'Bonjour. Précisez votre demande.' } }) }) });

    const amounts = [1, 7.5, 10, 12.75, 50, 120, 300, 1000];
    const phrases = [
      (n: number) => `Chrina pc b ${n} dt`, (n: number) => `chrit papier b ${n} DT`,
      (n: number) => `Acheté des livres à ${n} DT`, (n: number) => `Bought paper for ${n} TND`,
      (n: number) => `شرينا حاسوب ب ${n} دينار`, (n: number) => `Chrina pc b ${String(n).replace('.', ',')} DT`,
    ];
    for (const amount of amounts) for (const phrase of phrases) {
      const message = phrase(amount);
      await check('purchase-routing', message, async () => {
        const before = writes; readNames = []; const response = await draft(message);
        const card = response.pendingConfirmation as any;
        assert(card); assert.equal(card.arguments.amount, amount); assert(card.reviewFingerprint);
        assert.equal(card.status, 'PENDING'); assert.equal(writes, before); assert.equal(readNames.length, 0);
      });
    }
    for (const amount of amounts) await check('photo-priority', `Photo B ${amount} DT vs extracted 300`, async () => {
      const before = writes; const response = await draft(`B ${amount}dt`, true);
      assert.equal((response.pendingConfirmation as any)?.arguments.amount, amount); assert.equal(writes, before);
    });
    for (const message of ['Chrina pc', 'Chrina pc b -10 dt', 'Chrina pc b 0 dt', 'Chrina pc 10 dt et écran 20 dt', 'Chrina pc b 10 dt le 2026-02-30']) await check('clarification', message, async () => {
      const response = await draft(message); assert(!response.pendingConfirmation); assert.match(response.message, /Aucune dépense enregistrée/);
    });
    for (const [message, name] of [['Chkoun ya9raw 1a', 'get_students'], ['élèves classe 1A', 'get_students'], ['caisse du jour', 'get_daily_caisse'], ['impayés du mois', 'get_payments'], ['absences du jour', 'get_attendance'], ['effectifs école', 'get_school_stats'], ['U sure', 'get_students']]) await check('fresh-reads', message, async () => {
      readNames = []; const response = await draft(message); assert.equal(readNames[0], name); assert.equal(response.evidence?.schoolId, admin.schoolId); assert(!response.pendingConfirmation);
    });
    for (const message of ['What is our refund policy?', 'Quelle est notre politique de remboursement ?', 'شنية سياسة استرجاع معلوم الترسيم؟']) await check('knowledge-sources', message, async () => {
      const response = await draft(message); assert.equal(response.evidence?.source, 'school_knowledge'); assert.equal(response.evidence?.sources[0].id, 'policy'); assert(!response.pendingConfirmation);
    });
    for (const message of ['Aslema', 'Chnwa esmk enti', 'Oui', 'Go', 'Confirm', 'نفذ']) await check('text-is-not-approval', message, async () => {
      const before = writes; await draft(message); assert.equal(writes, before);
    });
    for (const message of ['Aslema', 'Chnwa esmk enti']) await check('undeclared-tool', message, async () => {
      const before = writes; injectedCall = { name: 'add_expense', args: { title: 'Injected', amount: 999 } };
      const response = await draft(message); injectedCall = null;
      assert(!response.pendingConfirmation); assert.equal(writes, before);
    });
    for (const message of ['9adeh 3ana mn mou3alem fl ecole', 'قداش عنا من أستاذ', 'How many teachers are in our school?']) await check('unverified-answer', message, async () => {
      const response = await draft(message); assert.match(response.message, /pas pu vérifier/); assert.doesNotMatch(response.message, /511|300/);
    });
    await check('action-pipeline', 'Missing/stale review, changed amount, cancel, concurrency and retry', async () => {
      const card = (await draft('Chrina pc b 10 dt')).pendingConfirmation as any;
      const before = writes;
      assert.equal((await decision(card, { reviewFingerprint: undefined })).actionStatus, 'PENDING');
      assert.equal((await decision(card, { schoolId: 'foreign-school' })).success, false);
      const revised: any = await decision(card, { updatedArgs: { amount: 7.5 } }); assert.equal(revised.actionStatus, 'PENDING');
      assert.equal((await decision(card)).actionStatus, 'PENDING'); assert.equal(writes, before);
      const outcomes = await Promise.all([decision(revised.proposal), decision(revised.proposal)]);
      assert(outcomes.some(result => result.actionStatus === 'EXECUTED')); assert.equal(writes, before + 1);
      await decision(revised.proposal); assert.equal(writes, before + 1);
      const cancelled = (await draft('Chrina pc b 1 dt')).pendingConfirmation as any;
      await decision(cancelled, { action: 'cancel' }); assert.equal((await decision(cancelled)).success, false); assert.equal(writes, before + 1);
      assert.notEqual(actionReviewFingerprint(card.toolCallId, 'add_expense', { amount: 10 }), revised.proposal.reviewFingerprint);
    });
    const groups = Object.fromEntries([...new Set(results.map(result => result.group))].map(group => [group, { passed: results.filter(result => result.group === group && result.passed).length, total: results.filter(result => result.group === group).length }]));
    console.log(JSON.stringify({ benchmark: 'Hnia reliability', mode: 'offline; mocked provider and database; actual routing and confirmation code', total: results.length, passed: results.filter(result => result.passed).length, groups, failures: results.filter(result => !result.passed) }, null, 2));
    if (results.some(result => !result.passed)) process.exitCode = 1;
  } finally {
    for (const undo of restore.reverse()) undo();
    if (env.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = env.key;
    if (env.storage === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = env.storage;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
