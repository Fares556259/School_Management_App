import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../lib/prisma';
import { SCHOOL_RECORDS, querySchoolRecords } from '../lib/telegram/tools/schoolRecords';
import { getAttendanceTool, getStudentsTool, getPaymentsTool, getFinancialSummaryTool } from '../lib/telegram/tools/readTools';
import { resolveClassByName } from '../lib/telegram/tools/classResolver';
import { getPartialPaymentsTool } from '../lib/telegram/tools/financeTools';
import { schoolDayRange, schoolDate, tuitionBalance, isVerificationFollowup, schoolMonth } from '../lib/agent/dataAccuracy';
import { formatSchoolRead, getExactSchoolRead } from '../lib/agent/schoolRead';
import { getMobileDeclarations, runMobileAgent } from '../lib/agent/mobileAgent';
import { TOOLS } from '../lib/telegram/tools';

const context={adminId:'admin-a',schoolId:'school-a',adminName:'Test Admin',language:'fr'};
async function main() {
 const restore:(()=>void)[]=[];
 const replace=(target:any,name:string,value:any)=>{const old=target[name];target[name]=value;restore.push(()=>{target[name]=old;});};
 const oldKey=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-with-no-network';
 const cls={id:1,name:'1A',schoolId:'school-a',levelId:1,capacity:100,supervisorId:null};
 let genericQueries=0;
 try {
  // All business datasets are queried through allowlisted fields and a mandatory tenant predicate.
  for(const [entity,definition] of Object.entries(SCHOOL_RECORDS)) {
   const model=Prisma.dmmf.datamodel.models.find(model=>model.name.toLowerCase()===definition.model.toLowerCase())!;
   assert(model,`Known model for ${entity}`);
   for(const field of definition.fields) assert(model.fields.some(item=>item.name===field),`Valid ${entity}.${field}`);
   assert(!definition.fields.some(field=>/password|token|secret|credential|newValues|oldValues/i.test(field)),`No credentials in ${entity}`);
   const check=({where}:any)=>{assert.equal(where.schoolId,'school-a');genericQueries++;};
   const delegate=(prisma as any)[definition.model];
   replace(delegate,'count',async (args:any)=>{check(args);return 580;});
   replace(delegate,'findMany',async (args:any)=>{check(args);assert(args.take<=100);assert(args.select);return [];});
   replace(delegate,'aggregate',async (args:any)=>{check(args);return {_sum:{amount:1234.5},_avg:{score:14.25}};});
   const result=await querySchoolRecords({entity,limit:50},context);
   assert.equal(result.success,true,entity);assert.equal(result.total,580);assert.equal(result.hasMore,true);
   assert.match(result.formattedText!,/0 affiché\(s\) sur 580/);
  }
  const before=genericQueries;
  assert.equal((await querySchoolRecords({entity:'admin'},context)).success,false);
  assert.equal((await querySchoolRecords({entity:'__proto__'},context)).success,false);
  assert.equal(genericQueries,before,'Unknown models never reach Prisma');
  // Credentials and another tenant cannot be injected through tool arguments.
  let parentsWhere:any;let parentSelect:any;
  replace(prisma.parent,'findMany',async ({where,select}:any)=>{parentsWhere=where;parentSelect=select;return [{id:'parent',name:'Amel',surname:'Test',phone:'20000000',accessStatus:'PENDING'}];});
  const parents=await querySchoolRecords({entity:'parents',schoolId:'school-b',select:{password:true}} as any,context);
  assert.equal(parents.success,true);assert.equal(parentsWhere.schoolId,'school-a');assert.equal(parentSelect.password,undefined);assert.equal(parentSelect.expoPushToken,undefined);
  // Class 1A must not accidentally resolve to 11A; ambiguous partial names are rejected.
  replace(prisma.class,'findMany',async ({where}:any)=>{assert.equal(where.schoolId,'school-a');return [{...cls,id:11,name:'11A'},cls,{...cls,id:2,name:'1B'}];});
  assert.equal((await resolveClassByName('school-a','1A'))?.id,1);
  assert.equal((await resolveClassByName('school-a','classe 1ère A'))?.id,1);
  assert.equal(await resolveClassByName('school-a','1'),null);
  assert.equal(await resolveClassByName('school-a','1AB'),null);
  const pupils=Array.from({length:130},(_,index)=>({id:`s${index}`,name:`Élève ${index}`,surname:'Test',phone:null,customTuition:0,class:{name:'1A'},level:{tuitionFee:450},parent:null}));
  replace(prisma.student,'count',async ({where}:any)=>{assert.equal(where.schoolId,'school-a');return pupils.length;});
  replace(prisma.student,'findMany',async ({where,take,skip=0}:any)=>{assert.equal(where.schoolId,'school-a');assert.equal(where.classId,1);return pupils.slice(skip,skip+take);});
  const page=await getStudentsTool({className:'1A'},context);
  assert.equal(page.total,130);assert.equal(page.returned,100);assert.equal(page.hasMore,true);assert.equal(page.nextOffset,100);assert.doesNotMatch(page.formattedText,/liste complète/);
  const last=await getStudentsTool({className:'1A',offset:100},context);
  assert.equal(last.returned,30);assert.equal(last.hasMore,false);assert.match(last.formattedText,/liste complète/);
  assert.equal(last.students[0].tuitionFee,'0 DT','A zero custom fee must never become the standard 450 DT');
  // Attendance beyond the old 60-record cap and duplicate lessons do not distort pupil counts.
  const statuses=Array.from({length:125},(_,index)=>({studentId:`s${index}`,status:index<70?'ABSENT':'PRESENT',_count:{_all:2}}));
  statuses.push({studentId:'s0',status:'PRESENT',_count:{_all:1}});
  replace(prisma.attendance,'groupBy',async ({where}:any)=>{assert.equal(where.schoolId,'school-a');return statuses;});
  replace(prisma.attendance,'findMany',async ()=>[]);
  const attendance=await getAttendanceTool({date:'2026-10-21'},context);
  assert.equal(attendance.summary.absentCount,70);assert.equal(attendance.summary.presentCount,55);assert.equal(attendance.summary.unrecordedCount,5);
  replace(prisma.attendance,'groupBy',async ()=>[]);
  const emptyAttendance=await getAttendanceTool({date:'2026-10-21'},context);
  assert.equal(emptyAttendance.summary.attendanceRate,'Non disponible');assert.equal(emptyAttendance.summary.presentCount,0);
  // Tunis timezone, including UTC-server month transitions.
  assert.equal(schoolDate(new Date('2026-10-31T23:30:00Z')),'2026-11-01');
  assert.equal(schoolMonth(undefined,undefined,new Date('2026-10-31T23:30:00Z')).month,11);
  assert.equal(schoolDayRange('2026-10-21').gte.toISOString(),'2026-10-20T23:00:00.000Z');
  assert.throws(()=>schoolDayRange('2026-02-30'));assert.throws(()=>schoolMonth(13,2026));
  assert.deepEqual(tuitionBalance({customTuition:0,level:{tuitionFee:450}}),{fee:0,received:0,due:0});
  assert.deepEqual(tuitionBalance({customTuition:200},{status:'PENDING',amount:200}),{fee:200,received:0,due:200});
  assert.deepEqual(tuitionBalance({customTuition:200},{status:'PARTIAL',amount:50.5,deferredAmount:149.5}),{fee:200,received:50.5,due:149.5});
  const feePupils=[{...pupils[0],customTuition:0,payments:[]},{...pupils[1],customTuition:200,payments:[{status:'PENDING',amount:200}]},{...pupils[2],customTuition:200,payments:[{status:'PARTIAL',amount:50.5,deferredAmount:149.5}]},{...pupils[3],customTuition:100,payments:[{status:'PAID',amount:100}]}];
  replace(prisma.student,'findMany',async ({where}:any)=>{assert.equal(where.schoolId,'school-a');return feePupils;});
  const payments=await getPaymentsTool({month:9,year:2025,status:'UNPAID'},context);
  assert.equal(payments.totalOutstanding,349.5);assert.equal(payments.overview.paidAmount,150.5);assert.equal(payments.records.length,2);assert.equal(payments.unpaidCount,2);
  replace(prisma.income,'aggregate',async ({where}:any)=>{assert.equal(where.schoolId,'school-a');assert.equal(where.date.gte.toISOString(),'2025-08-31T23:00:00.000Z');return {_sum:{amount:1000.5},_count:{id:5}};});
  replace(prisma.expense,'aggregate',async ()=>({_sum:{amount:200.25},_count:{id:2}}));
  replace(prisma.expense,'groupBy',async ()=>[]);
  const finance=await getFinancialSummaryTool({month:9,year:2025},context);
  assert.equal(finance.totalIncome,1000.5);assert.equal(finance.netProfit,800.25);assert.equal(finance.unpaidTuition,349.5);
  // Empty overdue filter must stay empty; never silently return all other recovery cases.
  replace(prisma.payment,'findMany',async ()=>[{id:1,month:10,year:2026,amount:50,deferredAmount:150,deferredUntil:null,student:null}]);
  const overdue=await getPartialPaymentsTool({status:'overdue'},context);
  assert.equal(overdue.count,0);assert.equal(overdue.items.length,0);assert.equal(overdue.totalOutstanding,0);
  // Tool pruning must preserve the specialised data domains; exact shortcuts must not steal scope.
  assert(getMobileDeclarations('notes et examens des élèves de la classe 1A').some(tool=>tool.name==='get_student_grades'));
  assert(getMobileDeclarations('demande parent et notification').some(tool=>tool.name==='query_school_records'));
  assert.equal(getExactSchoolRead('revenus septembre 2025'),null);assert.equal(getExactSchoolRead('impayés classe 1A'),null);assert.equal(getExactSchoolRead('caisse hier'),null);
  assert.deepEqual(getExactSchoolRead('Chkoun ya9raw 1a'),{name:'get_students',args:{className:'1A',limit:100,offset:0}});
  assert(isVerificationFollowup('U sure'));assert(isVerificationFollowup('Khw hedhom eli ya9raw'));
  const profileText=formatSchoolRead('get_student_profile',{student:{fullName:'Meriem Test',class:'1A',tuitionSummary:{monthlyFee:'200 DT / mois',totalPaid:'0 DT',totalRemainingDue:'2000 DT'},parent:{name:'Amel Test'}}});
  assert.match(profileText,/Meriem Test/);assert.doesNotMatch(profileText,/undefined|100%|À jour/);
  // A follow-up re-queries the previous read using its exact filters, even if facts changed.
  const logs:any[]=[];let readCalls=0;let latestArgs:any;let modelCalls=0;
  replace(prisma.admin,'findFirst',async ()=>({id:'admin-a',name:'Test',surname:'Admin',username:'test',School:{name:'Test School'}}));
  replace(prisma.aIConversation,'findFirst',async ()=>({id:'conv-a',title:'Class',messages:[]}));
  replace(prisma.aIConversation,'update',async ()=>({}));
  replace(prisma.aIMessage,'create',async ({data}:any)=>({id:'message',...data}));
  replace(prisma.aIToolCall,'findFirst',async ({where}:any)=>{assert.equal(where.conversationId,'conv-a');return {toolName:'get_students',arguments:{className:'1A',limit:100},result:{hasMore:false}};});
  replace(prisma.aIToolCall,'create',async ({data}:any)=>{logs.push(data);return {id:'log',...data};});
  replace(TOOLS.get_students,'execute',async (args:any)=>{readCalls++;latestArgs=args;return {total:9,returned:9,hasMore:false,formattedText:'9 élèves vérifiés en 1A'};});
  const verification=await runMobileAgent({...context,userMessage:'U sure',conversationId:'conv-a'});
  assert.equal(readCalls,1);assert.equal(latestArgs.className,'1A');assert.match(verification.message,/9 élèves/);assert.match(verification.message,/Nouvelle vérification/);
  // A model that declines both lookups cannot turn an unsupported number into a verified fact.
  replace(prisma.aIKnowledge,'findMany',async ()=>[]);
  replace(GoogleGenerativeAI.prototype,'getGenerativeModel',()=>({startChat:()=>({sendMessage:async ()=>{modelCalls++;return {response:{functionCalls:()=>[],text:()=> 'Il y a 999 élèves.'}};}})}));
  const ungrounded=await runMobileAgent({...context,userMessage:'Combien de nouvelles classes cette année ?',conversationId:'conv-a'});
  assert.equal(modelCalls,2);assert.doesNotMatch(ungrounded.message,/999/);assert.match(ungrounded.message,/pas pu vérifier/);
  assert(logs.some(log=>log.toolName==='get_students' && log.status==='EXECUTED'));
  console.log(`Hnia accuracy passed: ${Object.keys(SCHOOL_RECORDS).length} datasets, tenant isolation, hidden credentials, exact classes, 130 pupils, >60 attendance records, unpaid balances, dates, fresh follow-ups and grounding failures.`);
 } finally {
  for(const undo of restore.reverse()) undo();
  if(oldKey===undefined) delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
