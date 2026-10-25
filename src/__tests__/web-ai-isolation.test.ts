import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function main(){
 let allowed=false,ops=0;const queries:any[]=[];const writes:any[]=[];
 const db:any={admin:{findFirst:async(a:any)=>{ops++;assert.equal(a.where.id,'admin-a');assert.equal(a.where.schoolId,'school-a');return {id:'admin-a',aiUsage:0,aiQuota:10,lastAiUpdate:new Date()};}},student:{findMany:async(a:any)=>{ops++;assert.equal(a.where.schoolId,'school-a');assert.equal(a.take,undefined);return [{id:'child-a',name:'Amine',surname:'QA'}];}},$queryRaw:async(parts:any,...values:any[])=>{ops++;queries.push({sql:parts.join('?'),values});assert(values.includes('school-a'));return [{id:'child-a',name:'Amine',surname:'QA',tuitionFee:0}];},conversation:{findMany:async(a:any)=>{ops++;assert.equal(a.where.schoolId,'school-a');assert.equal(a.where.userId,'admin-a');return [];},update:async(a:any)=>{ops++;writes.push(a);assert.equal(a.where.schoolId,'school-a');assert.equal(a.where.userId,'admin-a');throw new Error('Foreign conversation');},create:async(a:any)=>{ops++;assert.equal(a.data.schoolId,'school-a');assert.equal(a.data.userId,'admin-a');return {id:'owned'};}}};
 const exports:any={};const modules:any={'@/lib/prisma':{__esModule:true,default:db},'@/lib/studentProfile':{getStudentAdminSchool:async()=>{if(!allowed)throw new Error('Denied');return 'school-a';}},'@/utils/supabase/server':{getAuthenticatedUser:async()=>({id:'admin-a'})},'next/cache':{revalidatePath:()=>{}},'@google/generative-ai':{},'@/lib/insightsCache':{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/(dashboard)/admin/actions/aiActions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,require:(n:string)=>{if(!(n in modules))throw new Error('Unmocked '+n);return modules[n];},process:{env:{}},console:{...console,error:()=>{},warn:()=>{},log:()=>{}},Date,Promise,Number,setTimeout});
 await exports.getAIContext(10,2026);await exports.getAIUsageStats();await exports.getConversations(10,2026);await exports.upsertConversation({title:'x',messages:[],month:10,year:2026});await exports.toggleTestAIQuota();
 await assert.rejects(()=>exports.callGeminiDirect('x'));
 assert.equal((await exports.getChatResponse('x',{})).success,false);
 await assert.rejects(()=>exports.getFinancialInsights({}));assert.equal(ops,0);
 allowed=true;const context=await exports.getAIContext(10,2026);assert.equal(context.studentCensus.length,1);assert.equal(context.unpaidPayments[0].amount,0);assert(!queries[0].sql.includes('LIMIT 100'));
 await exports.getConversations(10,2026);assert.equal((await exports.upsertConversation({id:'foreign',title:'x',messages:[],month:10,year:2026})).success,false);assert.equal((await exports.upsertConversation({id:'new',title:'x',messages:[],month:10,year:2026})).success,true);
 const before=ops;await exports.getAIContext(13,2026);assert.equal(ops,before);
 console.log('Legacy web assistant denies unauthorized data/provider access, scopes complete context and conversations to the current school/admin, and preserves zero tuition.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
