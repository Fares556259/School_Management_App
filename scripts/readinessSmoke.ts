/** Explicit, disposable tenant test. Never selects a real school's records. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import bcrypt from 'bcryptjs';
import { generateTemporaryParentPassword } from '../src/lib/temporaryPassword';
import { PrismaClient } from '@prisma/client';
import { createServerClient } from '@supabase/ssr';

if (process.env.READINESS_ISOLATED_LIVE !== '1') throw new Error('Set READINESS_ISOLATED_LIVE=1 to create and remove disposable QA schools.');
const base = process.env.READINESS_BASE_URL || 'https://www.snapschool.academy';
if (!['www.snapschool.academy','localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Unapproved test target');
const databaseUrl = process.env.DATABASE_URL!;
const db = new PrismaClient({datasources:{db:{url:databaseUrl + (databaseUrl.includes("?") ? "&" : "?") + "connection_limit=1"}}});
const run = `qa-readiness-${Date.now()}-${randomBytes(3).toString('hex')}`;
const schools = [run+'-a',run+'-b'];
const adminId = randomUUID();
const email = `${run}@example.invalid`;
const password = randomBytes(20).toString('base64url')+'!7a';
const phone = '000'+String(Date.now()).slice(-5);
const checks: any[] = [];
const cookies = new Map<string,string>();
const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:xs=>xs.forEach(x=>cookies.set(x.name,x.value))}});
let adminToken = '', parentToken = '', parentId = '', childA = '', childB = '', foreign = '';
let cleanup = false;
async function request(path:string, body?:any, token?:string, web=false) {
 const start=performance.now();
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(web?{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),Origin:base}: {})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
 const text=await response.text(); let data:any; try { data=JSON.parse(text); } catch { data={nonJson:true}; }
 return {status:response.status,data,ms:Math.round(performance.now()-start),cache:response.headers.get('cache-control')};
}
async function check(name:string,fn:()=>Promise<any>) {try{const details=await fn();checks.push({name,pass:true,...details});console.log('PASS',name);}catch(e:any){checks.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message.slice(0,200));}}
async function main(){
 try {
  // Establish a connection before creating fixtures; never retry uncertain writes.
  for(let attempt=0;;attempt++){try{await db.$queryRaw`SELECT 1`;break;}catch(error){if(attempt===2)throw error;await db.$disconnect();await new Promise(resolve=>setTimeout(resolve,1000));}}
  console.log("Fixture connection ready");
  for(const id of schools) await db.school.create({data:{id,name:'QA DISPOSABLE — '+id.slice(-1),subdomain:id,status:'ACTIVE',updatedAt:new Date()}});
  await db.$executeRaw`INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,phone_change,phone_change_token,email_change_token_current,reauthentication_token,is_sso_user,is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000'::uuid,${adminId}::uuid,'authenticated','authenticated',${email},extensions.crypt(${password},extensions.gen_salt('bf')),NOW(),jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','admin','status','active','schoolId',${schools[0]}::text),'{}'::jsonb,NOW(),NOW(),'','','','','','','','',false,false)`;
  await db.$executeRaw`INSERT INTO auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at) VALUES (${email},${adminId}::uuid,jsonb_build_object('sub',${adminId}::text,'email',${email}::text,'email_verified',true,'phone_verified',false),'email',NOW(),NOW(),NOW())`;
  await db.admin.create({data:{id:adminId,username:run,email,schoolId:schools[0],name:'QA',surname:'Administrator',status:'active'}});
  const levels=[]; for(const schoolId of schools) levels.push(await db.level.create({data:{schoolId,level:1,tuitionFee:200}}));
  const cls=await db.class.create({data:{schoolId:schools[0],levelId:levels[0].id,name:'QA1',capacity:150}});
  const rows=Array.from({length:131},(_,i)=>({id:`${run}-child-${i}`,username:`${run}-child-${i}`,name:i===0?'Amine QA':i===1?'Yasmine QA':'QA student',surname:String(i),address:'Fictional QA address',bloodType:'Unknown',sex:'MALE' as const,birthday:new Date('2018-01-01'),schoolId:i===130?schools[1]:schools[0],levelId:i===130?levels[1].id:levels[0].id,classId:i===130?null:cls.id,nationalId:`${Date.now()}${String(i).padStart(3,'0')}`}));
  await db.student.createMany({data:rows});[childA,childB,foreign]=[rows[0].id,rows[1].id,rows[130].id];
  const signed=await supabase.auth.signInWithPassword({email,password});assert.ifError(signed.error);
  const login=await request('/api/mobile/auth',{role:'admin',action:'signin',phone:email,password});assert.equal(login.status,200);adminToken=login.data.token;assert(adminToken);
  await check('Anonymous financial API is denied',async()=>{const r=await request('/api/mobile/admin/caisse');assert.equal(r.status,401);return {ms:r.ms};});
  const claims=[];for(const row of rows.slice(0,2)){const r=await request('/api/mobile/student/verify',{nationalId:row.nationalId});assert.equal(r.status,200);assert(!JSON.stringify(r.data).includes('Amine QA'));claims.push(r.data.claimToken);}
  await check('Parent signup creates requests without ownership',async()=>{const r=await request('/api/mobile/auth',{role:'parent',action:'signup',approvalFlowVersion:1,phone,password,parentName:'Sarra QA',parentSurname:'Fictional',address:'QA address Tunis',relation:'mother',locale:'en',claimTokens:claims});assert.equal(r.status,200);parentToken=r.data.token;parentId=r.data.userId;assert(parentToken);const p=await db.parent.findUnique({where:{phone}});parentId=p!.id;assert.equal(p!.accessStatus,'PENDING');assert.equal(p!.address,'QA address Tunis');assert.equal(await db.student.count({where:{parentId,schoolId:schools[0]}}),0);return {ms:r.ms};});
  assert(parentId&&parentToken,'Registration needed for remaining checks');
  await check('Pending parent is denied educational data',async()=>{const r=await request('/api/mobile/home',undefined,parentToken);assert.equal(r.status,403);return {ms:r.ms};});
  const requests=await db.parentAccessRequest.findMany({where:{schoolId:schools[0],parentId}});const a=requests.find(x=>x.studentId===childA)!, b=requests.find(x=>x.studentId===childB)!;
  await check('Admin approval requires identity confirmation',async()=>{const r=await request('/api/admin/parent-access',{action:'APPROVE',requestIds:[a.id]},undefined,true);assert.equal(r.status,400);return {ms:r.ms};});
  await check('Admin approval and sibling rejection succeed independently',async()=>{const approval=await request('/api/admin/parent-access',{action:'APPROVE',requestIds:[a.id],identityConfirmed:true},undefined,true);assert.equal(approval.data.results?.[0].success,true);const rejection=await request('/api/admin/parent-access',{action:'REJECT',requestIds:[b.id],reason:'QA test: verify sibling identity'},undefined,true);assert.equal(rejection.data.results?.[0].success,true);assert.equal((await db.parent.findUnique({where:{id:parentId}}))!.accessStatus,'ACTIVE');assert.equal(await db.student.count({where:{parentId}}),1);return {approvalMs:approval.ms,rejectionMs:rejection.ms};});
  await check('Opening status with original token shows current decisions',async()=>{const r=await request('/api/mobile/parent/access',undefined,parentToken);assert.equal(r.status,200);const approved=r.data.requests.find((x:any)=>x.id===a.id);const rejected=r.data.requests.find((x:any)=>x.id===b.id);assert.equal(approved.status,'APPROVED');assert.equal(approved.child.name,'Amine QA');assert.equal(rejected.status,'REJECTED');assert(!rejected.child);return {ms:r.ms};});
  await check('Decision inbox and durable delivery records are saved',async()=>{const r=await request('/api/mobile/notifications',undefined,parentToken);assert.equal(r.status,200);assert(await db.notification.count({where:{parentId,schoolId:schools[0]}})>=2);assert(await db.parentAccessDelivery.count({where:{parentId,schoolId:schools[0]}})>=2);return {ms:r.ms,note:'No real device push token used'};});
  await check('Parent cannot read foreign child data',async()=>{const r=await request(`/api/mobile/parent-data?studentId=${foreign}`,undefined,parentToken);assert.equal(r.status,200);assert(Array.isArray(r.data));assert.deepEqual(r.data.map((x:any)=>x.id),[childA]);assert(!JSON.stringify(r.data).includes(foreign));return {ms:r.ms};});
  await check('Parent cannot access administrator finances',async()=>{const r=await request('/api/mobile/admin/caisse',undefined,parentToken);assert.equal(r.status,403);return {ms:r.ms};});
  await check('All 130 unpaid children are returned, no 100-row cap',async()=>{const r=await request('/api/mobile/admin/caisse?month=10&year=2026',undefined,adminToken);assert.equal(r.status,200);assert.equal(r.data.unpaidStudents.length,130);assert.equal(r.data.summary.unpaidStudentsTotal,26000);return {ms:r.ms};});
  await check('Invalid cash month is rejected before querying',async()=>{const r=await request('/api/mobile/admin/caisse?month=13&year=2026',undefined,adminToken);assert.equal(r.status,400);return {ms:r.ms};});
  await check('Admin cannot collect for another school',async()=>{const r=await request('/api/mobile/admin/caisse',{action:'collect_student',studentId:foreign,amount:50,month:10,year:2026},adminToken);assert.equal(r.status,404);return {ms:r.ms};});
  await check('Partial collection then settlement preserves exact amounts',async()=>{for(const amount of [50,150]){const r=await request('/api/mobile/admin/caisse',{action:'collect_student',studentId:childA,amount,month:10,year:2026},adminToken);assert.equal(r.status,200);}const p=await db.payment.findUnique({where:{studentId_month_year:{studentId:childA,month:10,year:2026}}});assert.equal(p!.amount,200);assert.equal(p!.deferredAmount,0);assert.equal(p!.status,'PAID');const sum=await db.income.aggregate({where:{schoolId:schools[0]},_sum:{amount:true}});assert.equal(sum._sum.amount,200);});
  await check('Hnia answers a live class count from all 130 records',async()=>{const r=await request('/api/mobile/agent/chat',{message:'Combien exactement d élèves sont inscrits dans la classe QA1 ? Vérifie la base actuelle et donne uniquement le nombre total.'},adminToken);assert.equal(r.status,200);assert.match(JSON.stringify(r.data),/130/);return {ms:r.ms};});
  await check('Hnia cancellation and repeated confirmation do not duplicate expenses',async()=>{
   const conversation=await db.aIConversation.create({data:{adminId,source:'mobile',title:'Disposable readiness test'}});
   const proposal=()=>db.aIToolCall.create({data:{conversationId:conversation.id,toolName:'add_expense',arguments:{title:'QA disposable expense',amount:7,category:'QA'},requiresConfirm:true}});
   const cancelled=await proposal();assert.equal(await db.expense.count({where:{schoolId:schools[0]}}),0);
   const cancel=await request('/api/mobile/agent/confirm',{toolCallId:cancelled.id,action:'cancel'},adminToken);assert.equal(cancel.data.actionStatus,'REJECTED');assert.equal(await db.expense.count({where:{schoolId:schools[0]}}),0);
   const confirmed=await proposal();for(let i=0;i<2;i++){const r=await request('/api/mobile/agent/confirm',{toolCallId:confirmed.id,action:'confirm'},adminToken);assert.equal(r.data.actionStatus,'EXECUTED');}
   assert.equal(await db.expense.count({where:{schoolId:schools[0]}}),1);
  });
  await check('Password reset preserves the same parent and children; new credentials sign in',async()=>{
   async function load(file:string,modules:Record<string,any>){const exports:any={};vm.runInNewContext(ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,require:(name:string)=>{if(!(name in modules))throw new Error('Unmocked '+name);return modules[name];},console,Date,Promise,Number});return exports;}
   const auth={'@/lib/prisma':{__esModule:true,default:db},'@/lib/school':{getSchoolId:async()=>schools[0]},'@/utils/supabase/server':{getAuthenticatedUser:async()=>({id:adminId})}};
   const service=await load('src/lib/studentProfile.ts',auth);
   const actions=await load('src/lib/crudActions.ts',{...auth,'./studentProfile':service,'./subjectConstants':{},'./assignmentLessons':{},'./studentIdentifier':{},'next/cache':{revalidatePath:()=>{}},'@/lib/cache':{invalidateTenantTags:()=>{}},'@/lib/audit':{createAuditLog:async()=>{}},'./notifications':{},'@prisma/client':{},bcryptjs:bcrypt,'./temporaryPassword':{generateTemporaryParentPassword}});
   const before=await db.student.findMany({where:{parentId},select:{id:true}});
   const reset=await actions.resetParentPassword(parentId);assert.equal(reset.success,true);assert.match(reset.temporaryPassword,/^\d{8}$/);
   assert.deepEqual(await db.student.findMany({where:{parentId},select:{id:true}}),before);
   const oldLogin=await request('/api/mobile/auth',{role:'parent',action:'signin',approvalFlowVersion:1,phone,password});assert.equal(oldLogin.status,401);
   const login=await request('/api/mobile/auth',{role:'parent',action:'signin',approvalFlowVersion:1,phone,password:reset.temporaryPassword});assert.equal(login.status,200);
   // Execute the real deletion service on a fixture that has dependent payments.
   const target=rows[2].id;await db.payment.create({data:{schoolId:schools[0],studentId:target,month:10,year:2026,amount:20,status:'PARTIAL',userType:'student'}});
   const start=performance.now();const deleted=await actions.deleteStudent(target);assert.equal(deleted.success,true);assert.equal(await db.student.count({where:{id:target}}),0);assert.equal(await db.payment.count({where:{studentId:target}}),0);assert.equal(await db.student.count({where:{id:foreign}}),1);
   return {deletionMs:Math.round(performance.now()-start),note:'Real local server-action code and fixture database; session/cache adapters mocked. Mobile login checked live.'};
  });
  await check('Old admin JWT is denied after account is disabled',async()=>{await db.admin.update({where:{id:adminId},data:{status:'pending'}});try{const r=await request('/api/mobile/admin/caisse',undefined,adminToken);assert.equal(r.status,401);return {ms:r.ms};}finally{await db.admin.update({where:{id:adminId},data:{status:'active'}});}});
  await check('Revocation removes parent access with original JWT',async()=>{const r=await request('/api/admin/parent-access',{action:'REVOKE',requestIds:[a.id],reason:'QA test finished'},undefined,true);assert.equal(r.data.results?.[0].success,true);assert.equal((await request('/api/mobile/home',undefined,parentToken)).status,403);return {ms:r.ms};});
 } catch(error:any) { console.error("SETUP_OR_RUN_FAILURE",error.code,error.message); throw error; } finally {
  // All deletes are limited to the fresh random tenant IDs from this execution.
  await db.aIConversation.deleteMany({where:{adminId}});
  for(const schoolId of schools){
   for(const model of ['parentAccessDelivery','parentAccessRequest','notification','auditLog','payment','income','expense','student','class','level','parent','admin'] as const) await (db[model] as any).deleteMany({where:{schoolId}});
   await db.school.deleteMany({where:{id:schoolId}});
  }
  await db.$executeRaw`DELETE FROM auth.users WHERE id=${adminId}::uuid AND email=${email}`;
  cleanup=true;
  await writeFile(process.env.READINESS_REPORT || '/tmp/snapschool-readiness-live.json',JSON.stringify({run,adminId,base,checkedAt:new Date(),checks,cleanup},null,2));
  await db.$disconnect();
  if (checks.some(check => !check.pass)) process.exitCode=1;
 }
}
main().catch(async e=>{console.error('QA stopped:',e.message);await writeFile(process.env.READINESS_REPORT || '/tmp/snapschool-readiness-live.json',JSON.stringify({run,adminId,checks,cleanup,error:e.message},null,2));await db.$disconnect();process.exitCode=1;});
