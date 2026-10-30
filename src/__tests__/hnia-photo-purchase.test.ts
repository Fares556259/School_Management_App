import assert from 'node:assert/strict';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../lib/prisma';
import { TOOLS } from '../lib/telegram/tools';
import { runMobileAgent } from '../lib/agent/mobileAgent';
import { getPurchaseDraft } from '../lib/agent/purchaseDraft';

async function main() {
  const restores: (() => void)[] = [];
  const replace = (target: any, key: string, value: any) => { const old = target[key]; target[key] = value; restores.push(() => { target[key] = old; }); };
  const oldKey = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'test-no-network';
  const oldStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  const document = { documentType: 'GENERAL', title: 'Ordinateur portable', amount: 300, category: 'Maintenance', summary: 'Laptop' };
  let proposals: any[] = []; let writes = 0; let reads = 0; let models = 0;
  let functionCall = { name: 'get_school_stats', args: {} as Record<string, any> };
  try {
    replace(prisma.admin, 'findFirst', async () => ({ id: 'admin-test', username: 'Test', School: { name: 'Isolated Test School' } }));
    // A stale school statistics answer must not influence a new photo purchase.
    replace(prisma.aIConversation, 'findFirst', async () => ({ id: 'conv-test', title: 'Test', messages: [{ role: 'user', content: 'Effectifs école' }, { role: 'assistant', content: '511 élèves et 17 enseignants' }] }));
    replace(prisma.aIConversation, 'update', async () => ({}));
    replace(prisma.aIMessage, 'create', async ({ data }: any) => ({ id: 'msg', ...data }));
    replace(prisma.aIToolCall, 'create', async ({ data }: any) => { proposals.push(data); return { id: `proposal-${proposals.length}`, ...data }; });
    replace(prisma.aIKnowledge, 'findMany', async () => []);
    replace(prisma.class, 'findMany', async () => []);
    replace(prisma.expense, 'findFirst', async () => null);
    replace(TOOLS.add_expense, 'execute', async () => { writes++; throw new Error('Never execute while drafting'); });
    for (const name of ['get_expenses', 'get_school_stats']) replace(TOOLS[name], 'execute', async () => { reads++; throw new Error('Wrong read'); });
    replace(GoogleGenerativeAI.prototype, 'getGenerativeModel', (options: any) => {
      if (options.generationConfig?.responseMimeType === 'application/json') return { generateContent: async () => ({ response: { text: () => JSON.stringify(document) } }) };
      models++; return { startChat: () => ({ sendMessage: async () => ({ response: { functionCalls: () => [functionCall], text: () => 'Enregistré' } }) }) };
    });
    for (const [caption, amount] of [['B 1dt', 1], ['Chrina pc b 10 dt', 10], ['B 7,500 DT', 7.5]] as const) {
      proposals = [];
      const result = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', conversationId: 'conv-test', userMessage: caption, imageBase64: 'dGVzdA==' });
      assert.equal(result.success, true); assert.equal(proposals.length, 1);
      assert.equal(proposals[0].arguments.amount, amount, 'Typed amount must override a conflicting image price');
      assert.equal(proposals[0].status, 'PENDING'); assert.equal(proposals[0].requiresConfirm, true);
      assert.equal(result.widget?.type, 'action_card'); assert(result.pendingConfirmation);
      assert.equal(result.evidence, undefined); assert.match(result.message, /Aucune dépense enregistrée/);
      assert.doesNotMatch(result.message, /511|17 enseignants|300/);
    }
    assert.equal(writes, 0); assert.equal(reads, 0); assert.equal(models, 0);
    for (const caption of ['Chrina pc', 'Chrina pc b -10 dt', 'Chrina pc 10 dt et écran 20 dt']) {
      proposals = [];
      const result = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: caption, imageBase64: 'dGVzdA==' });
      assert.equal(proposals.length, 0); assert.equal(result.pendingConfirmation, undefined); assert.match(result.message, /Aucune dépense enregistrée/);
    }
    assert.equal(getPurchaseDraft('Combien coûte ce pc ?', document, undefined, true), null);
    assert.equal(getPurchaseDraft('', document, undefined, true), null, 'Object photos do not imply a purchase');
    assert.equal(getPurchaseDraft('', { ...document, documentType: 'EXPENSE_RECEIPT' }, undefined, true)?.args?.amount, 300);
    assert.equal(getPurchaseDraft('Chrina pc b 10 dt')?.args?.title, 'pc');
    // An out-of-scope model call must not execute, even if the registry contains it.
    const wrong = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: 'Aslema' });
    assert.match(wrong.message, /pas pu relier/); assert.equal(reads, 0); assert.equal(writes, 0);
    functionCall = { name: 'add_expense', args: { title: 'PC', amount: 300, category: 'Maintenance' } };
    proposals = [];
    const generated = await runMobileAgent({ adminId: 'admin-test', schoolId: 'school-test', userMessage: 'Ajoute une dépense de 10 DT pour PC' });
    assert.equal(proposals[0].arguments.amount, 10, 'The model cannot replace an explicit typed amount');
    assert.equal(proposals[0].status, 'PENDING'); assert(generated.pendingConfirmation); assert.equal(writes, 0);
    console.log('Photo purchases passed: 1/10/7.5 DT captions, conflicting vision price, stale history, confirmation-only drafts, missing/negative/ambiguous amount, and unauthorized tool rejection. No network or business writes.');
  } finally {
    for (const restore of restores.reverse()) restore();
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    if (oldStorageUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldStorageUrl;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
