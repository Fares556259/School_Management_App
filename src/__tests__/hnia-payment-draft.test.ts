import assert from 'node:assert/strict';
import prisma from '../lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TOOLS } from '../lib/telegram/tools';
import { runMobileAgent, getMobileDeclarations } from '../lib/agent/mobileAgent';
import { outputLanguageInstruction } from '../lib/agent/outputLanguage';
import { buildMobileHniaSystemInstruction } from '../lib/agent/hniaPrompt';
import { getNamedPaymentDraft } from '../lib/agent/paymentDraft';

async function main() {
  const restores: (() => void)[] = [];
  const replace = (target: any, key: string, value: any) => { const original = target[key]; target[key] = value; restores.push(() => { target[key] = original; }); };
  const oldKey = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'offline-test';
  let records: any[] = []; let writes = 0; let modelCalls = 0; let duplicate = false;
  try {
    replace(prisma.admin, 'findFirst', async () => ({ id: 'admin-test', schoolId: 'school-test', username: 'Test', School: { name: 'Synthetic School' } }));
    replace(prisma.aIConversation, 'findFirst', async () => ({ id: 'conv-test', title: 'Payments', messages: [{ role: 'user', content: 'Classe 1A' }, { role: 'assistant', content: 'Ancien montant : 30 DT' }] }));
    replace(prisma.aIConversation, 'update', async () => ({}));
    replace(prisma.aIMessage, 'create', async ({ data }: any) => ({ id: 'msg', ...data }));
    replace(prisma.aIToolCall, 'create', async ({ data }: any) => { records.push(data); return { id: 'proposal-test', ...data }; });
    replace(prisma.student, 'findMany', async ({ where }: any) => {
      assert.equal(where.schoolId, 'school-test'); assert(where.OR.length >= 2);
      const student = { id: 'student-exact-id', name: 'Fares', surname: 'fares', class: { name: '1A' } };
      return duplicate && !where.class && where.OR[0].id !== student.id
        ? [student, { ...student, id: 'other-student', class: { name: '2A' } }]
        : [student];
    });
    replace(prisma.student, 'findFirst', async () => ({ id:'student-exact-id', name:'Fares', surname:'fares', customTuition:100, tuitionOverrides:null, level:null }));
    replace(prisma.institution, 'findUniqueOrThrow', async () => ({academicYear:'2026-2027', halfBoundaryMonths:true, transportFrequency:'MONTHLY', gardeFrequency:'MONTHLY'}));
    replace(prisma.payment, 'findMany', async () => []);
    replace(prisma.studentCharge, 'findMany', async () => []);
    replace(prisma.studentChargeCategory, 'findMany', async () => []);
    replace(prisma.studentServiceAssignment, 'findUnique', async () => null);
    replace(prisma.parent, 'findMany', async ({ where }: any) => { assert.equal(where.schoolId, 'school-test'); return []; });
    replace(prisma.class, 'findMany', async () => []);
    replace(TOOLS.record_payment, 'execute', async () => { writes++; throw new Error('No write allowed while drafting'); });
    replace(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({ startChat: () => ({ sendMessage: async () => { modelCalls++; return { response: { functionCalls: () => [], text: () => 'Voici la proposition de paiement. Veuillez confirmer ci-dessous.' } }; } }) }));
    for (const language of ['fr', 'en', 'ar']) {
      records = [];
      const result = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: 'Fares fares khalsetna lyouma', language });
      const card = result.pendingConfirmation as any;
      assert.equal(result.widget?.type, 'action_card'); assert.equal(card.toolName, 'record_payment'); assert(card.reviewFingerprint);
      assert.equal(card.paymentReview?.type, 'student');
      assert.equal(card.arguments.studentNameOrId, 'student-exact-id'); assert.equal(card.arguments.amount, undefined, 'An old 30 DT answer cannot supply the amount received');
      assert.equal(card.fields.find((field: any) => field.label === 'Montant').value, 'À préciser');
      assert.equal(card.fields.find((field: any) => field.label === 'Bénéficiaire').value, 'Fares fares · 1A');
      assert.equal(records[0].status, 'PENDING'); assert.equal(records[0].requiresConfirm, true);
      assert.doesNotMatch(result.message, /حضرتلك|باش|ثبّت/); if (language === 'fr') assert.doesNotMatch(result.message, /[\u0600-\u06ff]/);
    }
    for (const message of ['Fares fares khalasni 45 dt lyouma', 'Fares fares 5allasni 45', 'Fares fares paid 45 TND', 'Fares fares a payé 45 DT', 'Fares fares خلصني 45 دينار']) {
      const result = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: message });
      assert.equal((result.pendingConfirmation as any)?.arguments.amount, 45, message);
    }
    assert.equal(modelCalls, 0); assert.equal(writes, 0);
    assert.equal(await getNamedPaymentDraft('Who paid today?', { adminId: 'admin-test', schoolId: 'school-test', adminName: 'Test', language: 'en' }), null);
    duplicate = true;
    const ambiguous = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: 'Fares fares khalasni lyouma' });
    assert.equal(ambiguous.pendingConfirmation, null); assert.match(ambiguous.message, /Plusieurs/);
    let history = [
      { role: 'assistant', content: ambiguous.message },
      { role: 'user', content: 'Fares fares khalasni lyouma' },
    ];
    replace(prisma.aIConversation, 'findFirst', async () => ({ id: 'conv-test', title: 'Payments', messages: history }));
    assert.deepEqual(ambiguous.followUpSuggestions?.map(value => JSON.parse(value.slice('payment-choice:'.length))[0]), ['Fares fares · 1A', 'Fares fares · 2A']);
    const selected = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: 'the one in 1A' });
    assert(selected.pendingConfirmation && !Array.isArray(selected.pendingConfirmation), selected.message);
    assert.equal(selected.pendingConfirmation.arguments.studentNameOrId, 'student-exact-id');
    history = [{ role: 'assistant', content: selected.message, toolCallId: 'proposal-test' } as typeof history[number]];
    replace(prisma.aIToolCall, 'findFirst', async ({ where }: any) => {
      assert.equal(where.conversationId, 'conv-test');
      assert.equal(where.status, 'PENDING');
      return { ...records.at(-1), id: 'proposal-test', createdAt: new Date() };
    });
    replace(prisma.aIToolCall, 'updateMany', async () => ({ count: 1 }));
    const updated = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: '45 DT' });
    assert(updated.pendingConfirmation && !Array.isArray(updated.pendingConfirmation));
    assert.equal(updated.pendingConfirmation.toolCallId, 'proposal-test');
    assert.equal(updated.pendingConfirmation.arguments.amount, 45);
    const december = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: 'same student, but for December' });
    assert(december.pendingConfirmation && !Array.isArray(december.pendingConfirmation), december.message);
    assert.equal(december.pendingConfirmation.toolCallId, 'proposal-test');
    assert.equal(december.pendingConfirmation.arguments.month, 12);
    assert.equal(writes, 0);
    assert(getMobileDeclarations('Fares fares khalasni lyouma').some(tool => tool.name === 'record_payment'));
    const ghost = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: 'Prépare un paiement' });
    assert(!ghost.pendingConfirmation); assert.doesNotMatch(ghost.message, /Voici la proposition/); assert.match(ghost.message, /pas pu préparer/); assert.equal(writes, 0);
    const prompt = buildMobileHniaSystemInstruction({ schoolName: 'Test', adminName: 'Admin' });
    assert.match(prompt, /arabe standard moderne/); assert.doesNotMatch(prompt, /réponds-lui chaleureusement|حضرتلك/);
    assert.match(outputLanguageInstruction('ar'), /الفصحى/); assert.match(outputLanguageInstruction('fr'), /uniquement en français/);
    console.log('Payment cards: exact student ID, missing amount, typed amount, Derja/FR/EN/Arabic input, ambiguity refusal, no writes, no phantom proposals, professional output instructions.');
  } finally { for (const restore of restores.reverse()) restore(); if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
