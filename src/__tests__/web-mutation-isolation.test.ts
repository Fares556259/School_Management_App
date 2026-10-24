import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function main(){
 let allowed=false, operations=0; const calls:any[]=[];
 const db:any=new Proxy({}, {get:(_,model)=>new Proxy({}, {get:(_,method)=>async(args:any)=>{
  operations++;calls.push({model,method,args});assert.equal(args.where.schoolId,'school-a',`${String(model)}.${String(method)} must scope its target`);
  if(method==='findUnique'||method==='findFirst')return null;
  if(method==='delete'||method==='update')throw new Error('Record outside school');
  throw new Error('Unexpected database operation');
 }})});
 const exports:any={};const modules:any={
  '@/lib/prisma':{__esModule:true,default:db},'@/utils/supabase/server':{getAuthenticatedUser:async()=>({id:'admin-a'})},
  './studentProfile':{getStudentAdminSchool:async()=>{if(!allowed)throw new Error('Denied');return 'school-a';}},
  './assignmentLessons':{getAssignmentAccess:async()=>{if(!allowed)throw new Error('Denied');return {schoolId:'school-a',teacherId:'teacher-a'};}},
  './subjectConstants':{},'./studentIdentifier':{},'next/cache':{revalidatePath:()=>{}},'@/lib/cache':{invalidateTenantTags:()=>{}},'@/lib/audit':{createAuditLog:async()=>{}},'./notifications':{},'@prisma/client':{},bcryptjs:{},'./temporaryPassword':{},
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/crudActions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,require:(name:string)=>{if(!(name in modules))throw new Error('Unmocked '+name);return modules[name];},console:{...console,error:()=>{},log:()=>{}},Date,Promise,Number});
 // Every exported server action must reject before any database operation when admin/teacher authorization fails.
 for(const [name,action] of Object.entries(exports)){
  assert.equal(typeof action,'function');const result=await (action as Function)('foreign',{});
  assert(result.success===false || result.error || (name.endsWith("PhoneExists") && result.exists===false),`${name} bypassed authorization`);assert.equal(operations,0,`${name} touched the database before authorization`);
 }
 allowed=true;
 for(const name of ['deleteTeacher','deleteStaff','deleteParent','deleteClass','deleteSubject','deleteExpense','deleteIncome','deleteNotice','deleteAssignment','deleteResource','resetTeacherPassword']){
  assert.equal((await exports[name]('foreign')).success,false);
 }
 for(const name of ['updateTeacher','updateStaff','updateParent','updateClass','updateSubject','updateExpense','updateIncome','updateNotice']){
  assert.equal((await exports[name]('foreign',{img:'safe.png',schoolId:'school-b',School:{connect:{id:'school-b'}},password:'injected'})).success,false);
 }
 const beforeLink = calls.length;
 assert.equal((await exports.linkStudentToParent('child-a','foreign-parent')).success,false);
 assert.equal(calls.length,beforeLink+1);
 assert.equal(calls.at(-1).model,'parent');
 assert.equal(calls.at(-1).args.where.id,'foreign-parent');
 for(const {args,model,method} of calls){
  if(method==='update')for(const forbidden of ['schoolId','School','password'])assert(!(forbidden in args.data) || (forbidden==='password' && args.data.password===null),`${model} permits ${forbidden} injection`);
  if(model==='assignment'||model==='resource'){assert.equal(args.where.lesson.teacherId,'teacher-a');assert.equal(args.where.lesson.schoolId,'school-a');}
 }
 console.log(`All ${Object.keys(exports).length} web server actions deny unauthorized callers before database access; management targets and teacher-owned deletions are school-scoped; forged update fields ignored.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
