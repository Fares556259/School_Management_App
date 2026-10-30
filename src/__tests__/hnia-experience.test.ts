import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/mobileAuth';
import { buildReadPresentation } from '../lib/agent/readPresentation';
import { runMobileAgent } from '../lib/agent/mobileAgent';
import { TOOLS } from '../lib/telegram/tools';
import { GET as briefing } from '../app/api/mobile/agent/briefing/route';
import { POST as chat } from '../app/api/mobile/agent/chat/route';
import { GET as history } from '../app/api/mobile/agent/history/route';

async function main() {
  const restore: Array<() => void> = [];
  const replace = (object: any, key: string, implementation: any) => { const old = object[key]; object[key] = implementation; restore.push(() => { object[key] = old; }); };
  const oldJwt = process.env.JWT_SECRET, oldGemini = process.env.GEMINI_API_KEY;
  process.env.JWT_SECRET = 'hnia-ui-test-secret-at-least-32-characters';
  process.env.GEMINI_API_KEY = 'fake-model-key';
  try {
    const scope = { schoolId: 'school-a', schoolName: 'Synthetic School' };
    const presented = buildReadPresentation('get_students', { className: '1A', token: 'secret' }, { total: 130, students: [{ fullName: 'Ahmed Test', class: '1A', parent: 'Amel Test (22112233)' }], classId: 9, hasMore: true, fetchedAt: '2026-10-30T08:00:00Z' }, scope, 'read-a');
    assert.equal(presented.evidence?.total, 130);
    assert.equal(presented.evidence?.schoolId, 'school-a');
    assert.equal(presented.evidence?.toolCallId, 'read-a');
    assert.equal(presented.evidence?.filters.token, undefined);
    assert.equal((presented.widget?.data as any).rows[0].detail, 'Amel Test (22••••33)');
    assert.equal((presented.widget?.data as any).classId, 9);
    assert.deepEqual(buildReadPresentation('get_students', {}, { success: false, total: 999 }, scope, 'bad'), { evidence: null, widget: null });
    assert.equal(buildReadPresentation('get_payments', { status: 'PAID' }, { records: [{ studentName: 'Paid' }], unpaidCount: 90, month: 10, year: 2026 }, scope, 'paid').evidence?.total, 1, 'Paid list must not use unpaid count');

    let aggregateReads = 0, writes = 0, lookupCount = 0, toolRuns = 0;
    replace(prisma.admin, 'findFirst', async ({ where }: any) => { assert.equal(where.schoolId, 'school-a'); return { id: 'admin-a', name: 'Test', School: { name: 'Synthetic School' } }; });
    replace(prisma.parent, 'findFirst', async () => ({ accessStatus: 'ACTIVE' }));
    replace(prisma, '$queryRaw', async (parts: TemplateStringsArray, ...values: any[]) => { aggregateReads++; assert.equal(values.filter(value => value === 'school-a').length, 6); assert.match(parts.join(''), /COUNT\(DISTINCT "studentId"\)/); return [{ parentRequests: 3, absentStudents: 2, todayRevenue: 0, unpaidStudents: 4 }]; });
    const token = generateToken({ userId: 'admin-a', userType: 'admin', schoolId: 'school-a' });
    const request = (endpoint: string, body?: any, bearer = token) => new NextRequest(`https://example.com${endpoint}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const response = await briefing(request('/api/mobile/agent/briefing'));
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual((await response.json()).metrics, { parentRequests: 3, absentStudents: 2, todayRevenue: 0, unpaidStudents: 4 });
    const parent = generateToken({ userId: 'parent-a', userType: 'parent', schoolId: 'school-a' });
    assert.equal((await briefing(request('/api/mobile/agent/briefing', undefined, parent))).status, 403);
    assert.equal(aggregateReads, 1);
    replace(prisma.aIConversation, 'findFirst', async () => { lookupCount++; return { id: 'old-conversation', title: 'Old', messages: [] }; });
    replace(prisma.aIConversation, 'create', async () => ({ id: 'new-conversation' }));
    replace(prisma.aIConversation, 'update', async () => ({}));
    replace(prisma.aIMessage, 'create', async () => { writes++; return {}; });
    replace(prisma.aIToolCall, 'findFirst', async ({ where }: any) => { assert.equal(where.conversationId, 'old-conversation'); assert.equal(where.requiresConfirm, false); return null; });
    replace(TOOLS.get_students, 'execute', async () => { toolRuns++; return {}; });
    const result = await runMobileAgent({ adminId: 'admin-a', schoolId: 'school-a', userMessage: 'Bonjour', newConversation: true });
    assert.equal(result.conversationId, 'new-conversation'); assert.equal(lookupCount, 0, 'New topic must not resume latest conversation');
    const invalidRefresh = await runMobileAgent({ adminId: 'admin-a', schoolId: 'school-a', conversationId: 'old-conversation', userMessage: 'Refresh', refreshReadId: 'foreign-or-mutation' });
    assert.equal(invalidRefresh.error, 'READ_NOT_FOUND'); assert.equal(toolRuns, 0);
    replace(prisma.aIToolCall, 'findFirst', async ({ where }: any) => { assert.equal(where.id, 'older-read'); return { toolName: 'get_students', arguments: { className: '1A', limit: 100 }, result: { scopeSchoolId: 'school-a', nextOffset: 100, hasMore: true } }; });
    replace(prisma.aIToolCall, 'create', async () => ({ id: 'next-read' }));
    replace(TOOLS.get_students, 'execute', async (args: any) => { assert.equal(args.className, '1A'); assert.equal(args.offset, 100); return { total: 130, students: [], returned: 0, hasMore: false }; });
    const nextPage = await runMobileAgent({ adminId: 'admin-a', schoolId: 'school-a', conversationId: 'old-conversation', userMessage: 'Page suivante', refreshReadId: 'older-read', nextReadPage: true });
    assert.equal(nextPage.evidence?.toolCallId, 'next-read', 'Pagination must target the card read, not the most recent unrelated read');
    const beforeTranscribe = writes;
    replace(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({ generateContent: async () => ({ response: { text: () => 'Ajoute une dépense de 120 DT' } }) }));
    const transcriptResponse = await chat(request('/api/mobile/agent/chat', { transcribeOnly: true, audioBase64: 'fake-audio', audioMimeType: 'audio/mp4' }));
    assert.equal((await transcriptResponse.json()).transcription, 'Ajoute une dépense de 120 DT');
    assert.equal(writes, beforeTranscribe, 'Voice review must neither save a chat command nor propose/execute an action');
    replace(prisma.aIConversation, 'findFirst', async ({ where, include }: any) => {
      assert.equal(where.id, 'old-conversation');
      assert.equal(where.OR[0].adminId, 'admin-a');
      assert.deepEqual(include.messages.where, { content: { contains: 'classe', mode: 'insensitive' } });
      return { id: 'old-conversation', messages: [{ id: 'message-read', role: 'assistant', content: 'Classe 1A', toolCallId: 'read-in-history' }], toolCalls: [] };
    });
    replace(prisma.aIToolCall, 'findMany', async ({ where }: any) => {
      assert.deepEqual(where.id.in, ['read-in-history']); assert.equal(where.conversationId, 'old-conversation'); assert.equal(where.requiresConfirm, false);
      return [{ id: 'read-in-history', toolName: 'get_students', arguments: { className: '1A' }, result: { scopeSchoolId: 'school-a', total: 0, students: [], fetchedAt: '2026-10-29T08:00:00Z' } }];
    });
    const restored = await history(request('/api/mobile/agent/history?conversationId=old-conversation&search=classe'));
    const restoredData = await restored.json();
    assert.equal(restoredData.messages[0].evidence.fetchedAt, '2026-10-29T08:00:00Z', 'Reopening must preserve the original query time');
    assert.equal(restoredData.messages[0].widget.type, 'school_records');
    console.log('Hnia experience passed: verified counts/masking, school-scoped briefing, new topics, refresh ownership and voice-review without actions.');
  } finally {
    restore.reverse().forEach(undo => undo());
    if (oldJwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldJwt;
    if (oldGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldGemini;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
