import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function main(){
 let role='admin', exists=true, active=true, schoolActive=true, signedIn=true, unavailable=false;
 const db:any={};for(const type of ['admin','teacher','parent','student'])db[type]={findFirst:async({where}:any)=>{
  assert.equal(where.id,'user-a');assert.equal(where.School.status,'ACTIVE');
  if(type==='admin')assert.equal(where.status,'active');if(type==='parent')assert.equal(where.accessStatus,'ACTIVE');
  if(unavailable)throw new Error('Database unavailable');
  return type===role&&exists&&schoolActive&&(active||!['admin','parent'].includes(type))?{schoolId:'school-a'}:null;
 }};
 const modules:any={react:{cache:(fn:any)=>fn},'./prisma':{__esModule:true,default:db},'@/utils/supabase/server':{getAuthenticatedUser:async()=>signedIn?{id:'user-a',app_metadata:{schoolId:'stale-school',role:'admin',status:'active'}}:null}};
 const exports:any={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/school.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:(name:string)=>{if(!(name in modules))throw new Error('Unexpected metadata fallback '+name);return modules[name];},console:{error:()=>{}},Promise});
 for(role of ['admin','teacher','parent','student']){
  assert.equal(await exports.getSchoolId(),'school-a');
  exists=false;await assert.rejects(exports.getSchoolId());exists=true;
  schoolActive=false;await assert.rejects(exports.getSchoolId());schoolActive=true;
  unavailable=true;await assert.rejects(exports.getSchoolId());unavailable=false;
  if(['admin','parent'].includes(role)){active=false;await assert.rejects(exports.getSchoolId());active=true;}
 }
 signedIn=false;await assert.rejects(exports.getSchoolId());
 console.log('Web tenant resolution requires current active membership, rejects suspended schools and DB failures, and never trusts stale metadata.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
