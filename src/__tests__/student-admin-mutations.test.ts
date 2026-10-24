import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file:string,modules:Record<string,any>){const exports:any={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,require:(name:string)=>{if(!(name in modules))throw new Error('Unmocked '+name);return modules[name];},console,Date,Promise,Number});return exports;}
async function main(){
 let signedIn=true,active=true,foreign=false,writes=0,linkedChildren=2;
 const db:any={admin:{findFirst:async({where}:any)=>{assert.equal(where.id,'admin-a');assert.equal(where.schoolId,'school-a');assert.equal(where.status,'active');assert.equal(where.School.status,'ACTIVE');return active?{id:'admin-a'}:null;}},student:{findFirst:async({where}:any)=>{assert.equal(where.schoolId,'school-a');return foreign?null:{id:where.id,name:'QA',surname:'Child'};},delete:async()=>{writes++;return{};}},parent:{findFirst:async({where}:any)=>{assert.equal(where.schoolId,'school-a');return foreign?null:{id:where.id,name:'QA',surname:'Parent'};},update:async({where,data}:any)=>{assert.equal(where.schoolId,'school-a');assert.deepEqual(Object.keys(data),['password']);assert.match(data.password,/^HASH:/);writes++;return{};}},$transaction:async(xs:any)=>Promise.all(xs)};
 for(const model of ['attendance','grade','result','payment','notification'])db[model]={deleteMany:async({where}:any)=>{assert.equal(where.schoolId,'school-a');assert.equal(where.studentId,'child-a');writes++;return {count:0};}};
 db.notice={updateMany:async({where}:any)=>{assert.equal(where.schoolId,'school-a');writes++;return {count:0};}};
 db.auditLog={create:async({data}:any)=>{assert.equal(data.performedBy,'admin-a');assert.equal(data.schoolId,'school-a');writes++;return{};}};
 const auth={'@/lib/prisma':{__esModule:true,default:db},'@/lib/school':{getSchoolId:async()=>'school-a'},'@/utils/supabase/server':{getAuthenticatedUser:async()=>signedIn?{id:'admin-a'}:null}};
 const service=load('src/lib/studentProfile.ts',auth);
 const actions=load('src/lib/crudActions.ts',{...auth,'./studentProfile':service,'./subjectConstants':{},'./assignmentLessons':{},'./studentIdentifier':{},'next/cache':{revalidatePath:()=>{}},'@/lib/cache':{invalidateTenantTags:()=>{}},'@/lib/audit':{createAuditLog:async()=>{}},'./notifications':{},'@prisma/client':{},bcryptjs:{hash:async(v:string)=>'HASH:'+v},'./temporaryPassword':{generateTemporaryParentPassword:()=>'12345678'}});
 for(const mutation of [()=>actions.deleteStudent('child-a'),()=>actions.resetParentPassword('parent-a')]){
  signedIn=false;assert.equal((await mutation()).success,false);signedIn=true;active=false;assert.equal((await mutation()).success,false);active=true;foreign=true;assert.equal((await mutation()).success,false);foreign=false;assert.equal(writes,0);
 }
 assert.equal((await actions.resetParentPassword('parent-a')).success,true);assert.equal(linkedChildren,2);assert.equal(writes,1);
 assert.equal((await actions.deleteStudent('child-a')).success,true);assert(writes>1);
 console.log('Student deletion and parent reset require active same-school admin; absent/foreign accounts rejected before mutations; reset changes only password.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
