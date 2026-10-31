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
      return duplicate ? [student, { ...student, id: 'other-student' }] : [student];
    });
    replace(prisma.parent, 'findMany', async ({ where }: any) => { assert.equal(where.schoolId, 'school-test'); return []; });
    replace(prisma.class, 'findMany', async () => []);
    replace(TOOLS.record_payment, 'execute', async () => { writes++; throw new Error('No write allowed while drafting'); });
    replace(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({ startChat: () => ({ sendMessage: async () => { modelCalls++; return { response: { functionCalls: () => [], text: () => 'Voici la proposition de paiement. Veuillez confirmer ci-dessous.' } }; } }) }));
    for (const language of ['fr', 'en', 'ar']) {
      records = [];
      const result = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: 'Fares fares khalasni lyouma', language });
      const card = result.pendingConfirmation as any;
      assert.equal(result.widget?.type, 'action_card'); assert.equal(card.toolName, 'record_payment'); assert(card.reviewFingerprint);
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
