import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

function load(file: string, modules: Record<string, any>, globals: Record<string, any> = {}) {
  const exports: any = {};
  const source = fs.readFileSync(file, 'utf8');
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.ES2020, true);
  assert.equal((syntax as any).parseDiagnostics.length, 0, `Invalid syntax in ${file}`);
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  vm.runInNewContext(code, { exports, require: (name: string) => {
    if (!(name in modules)) throw new Error(`Unmocked import: ${name}`);
    return modules[name];
  }, console: { ...console, error: () => {} }, Date, Set, Map, crypto: {randomUUID: ()=>'synthetic-student'}, ...globals }, { filename: file });
  return exports;
}

async function main() {
  let signedIn = true, admin = true, foreignStudent = false, foreignClass = false, foreignParent = false;
  let writes = 0, saved: any;
  let duplicates: Array<{id:string,nationalId:string}> = [];
  let locked = false;
  const assertSchool = (where: any) => assert.equal(where.schoolId, 'school-a');
  const prisma: any = {
    $transaction: async (fn:any, options:any) => { assert.equal(options.isolationLevel,"ReadCommitted"); locked=false; return fn(prisma); },
    $executeRaw: async (_sql:any, schoolId:string) => { assert.equal(schoolId,"school-a"); locked=true; },
    admin: { findFirst: async ({where}: any) => { assertSchool(where); assert.equal(where.id, 'admin-a'); return admin ? {id:'admin-a'} : null; } },
    student: {
      findMany: async ({where}:any) => { assertSchool(where); assert.ok(locked,"Lock must precede duplicate lookup"); return duplicates.filter(s=>where.nationalId.in.includes(s.nationalId)); },
      findFirst: async ({where}: any) => { assertSchool(where); return foreignStudent ? null : {id:where.id}; },
      create: async ({data}: any) => { writes++; saved=data; },
      update: async ({where, data}: any) => { assertSchool(where); writes++; saved=data; },
    },
    class: { findFirst: async ({where}: any) => { assertSchool(where); return foreignClass ? null : {levelId:4}; } },
    parent: { findFirst: async ({where}: any) => { assertSchool(where); return foreignParent ? null : {id:where.id}; } },
    level: { findFirst: async ({where}: any) => { assertSchool(where); return {id:4}; } },
  };
  const service = load('src/lib/studentProfile.ts', {
    '@/lib/prisma': {__esModule:true,default:prisma}, '@/lib/school': {getSchoolId:async ()=>'school-a'},
    '@/utils/supabase/server': {getAuthenticatedUser:async ()=>signedIn ? {id:'admin-a'} : null},
  });
  const identifiers = load('src/lib/studentIdentifier.ts', {'@/lib/prisma': {__esModule:true,default:prisma}});
  const actions = load('src/lib/crudActions.ts', {
    '@/lib/prisma': {__esModule:true,default:prisma}, '@/lib/school': {getSchoolId:async ()=>'school-a'},
    './subjectConstants':{}, './assignmentLessons':{}, './studentProfile':service, './studentIdentifier':identifiers,
    'next/cache':{revalidatePath:()=>{}}, '@/lib/cache':{invalidateTenantTags:()=>{}},
    '@/lib/audit':{createAuditLog:async()=>{}}, './notifications':{}, '@prisma/client':{},
  });
  const base = {name:'Demo',surname:'Student',sex:'MALE',classId:6,parentId:'parent-a'};
  assert.equal((await actions.createStudent({...base,nationalId:' 0012345678 '})).success,true);
  assert.equal(saved.nationalId,'0012345678'); assert.equal(saved.schoolId,'school-a');
  assert.equal((await actions.createStudent(base)).success,true); assert.equal(saved.nationalId,null);
  for (const value of ['0012345678','0098765432','   ',null]) {
    assert.equal((await actions.updateStudent('student-a',{nationalId:value})).success,true);
    assert.equal(saved.nationalId,typeof value==='string' ? value.trim() || null : null);
  }
  assert.equal((await actions.updateStudent('student-a',{name:'Demo updated'})).success,true);
  assert.equal('nationalId' in saved,false,'Omitted identifier does not erase an existing value');
  assert.equal((await actions.updateStudent('student-a',{...base,schoolId:'school-b',id:'student-b',School:{connect:{id:'school-b'}}})).success,true);
  assert.equal('schoolId' in saved,false); assert.equal('id' in saved,false); assert.equal('School' in saved,false);
  assert.equal(saved.levelId,4,'Class selection preserves automatic level assignment');
  assert.equal((await actions.updateStudent('student-a',{parentId:null,classId:null})).success,true);
  assert.equal(saved.parentId,null); assert.equal(saved.classId,null);
  duplicates=[{id:'student-other',nationalId:'0012345678'}];
  const beforeDuplicate=writes;
  assert.equal((await actions.bulkCreateStudents([{...base,nationalId:'0012345678'}])).success,false,'Import rejects an existing school identifier');
  assert.equal((await actions.bulkCreateStudents([{...base,nationalId:' 0099 '},{...base,nationalId:'0099'}])).success,false,'Import rejects repeated normalized identifiers before any writes');
  for (const result of [await actions.createStudent({...base,nationalId:' 0012345678 '}), await actions.updateStudent('student-a',{nationalId:'0012345678'})]) {
    assert.equal(result.success,false); assert.match(result.error,/déjà utilisé/);
  }
  assert.equal(writes,beforeDuplicate,'Duplicate identifiers must not be written');
  duplicates=[{id:'student-a',nationalId:'0012345678'}];
  assert.equal((await actions.updateStudent('student-a',{nationalId:'0012345678'})).success,true,'Keeping own ID is allowed');
  duplicates=[];
  let bulkWritten=false;
  await assert.rejects(identifiers.withUniqueStudentIdentifiers('school-a',[{nationalId:'001'},{nationalId:'001'}],async()=>{bulkWritten=true;}),/déjà utilisé/);
  assert.equal(bulkWritten,false,'Duplicate IDs inside an import reject the entire batch');
  await identifiers.withUniqueStudentIdentifiers('school-a',[{nationalId:null},{nationalId:null}],async()=>{bulkWritten=true;});
  assert.equal(bulkWritten,true,'Multiple students without identifiers are allowed');
  const before=writes;
  signedIn=false; assert.equal((await actions.updateStudent('student-a',{nationalId:'01'})).success,false);
  signedIn=true; admin=false;
  assert.equal((await actions.createStudent(base)).success,false);
  assert.equal((await actions.updateStudent('student-a',{nationalId:'01'})).success,false);
  admin=true; foreignStudent=true; assert.equal((await actions.updateStudent('student-b',{nationalId:'01'})).success,false);
  foreignStudent=false; foreignClass=true;
  assert.equal((await actions.updateStudent('student-a',{classId:99})).success,false);
  assert.equal((await actions.createStudent(base)).success,false);
  foreignClass=false; foreignParent=true;
  assert.equal((await actions.updateStudent('student-a',{parentId:'parent-b'})).success,false);
  assert.equal((await actions.createStudent(base)).success,false);
  foreignParent=false;
  assert.equal((await actions.updateStudent('student-a',{nationalId:123})).success,false);
  assert.equal((await actions.createStudent({...base,nationalId:123})).success,false);
  assert.equal(writes,before,'Unauthorized or foreign-school mutations are rejected before writes');

  let locale='fr', form: any, promise: Promise<any>, submitted: any, fail=false;
  const changes: Array<{index:number,value:any}>=[];
  let stateIndex=0;
  const translations=Object.fromEntries(['fr','en','ar'].map(loc=>[loc,load(`src/lib/translations/${loc}.ts`,{})[loc]]));
  const language={useLanguage:()=>({locale,t:translations[locale]})};
  const presentation=load('src/components/StudentProfileDialog.tsx', {
    '@radix-ui/react-dialog':{}, 'react/jsx-runtime':require('react/jsx-runtime'),
    'lucide-react': require('lucide-react'), '@/lib/translations/LanguageContext':language,
  });
  const formActions: any = {};
  for(const name of ['createStudent','updateStudent']) formActions[name]=async (...args:any[])=>{
    submitted=args.at(-1); return fail ? {success:false,error:'Synthetic save failure'} : {success:true};
  };
  const modal=load('src/components/CrudFormModal.tsx', {
    react:{...React,useState:(initial:any)=>{const index=stateIndex++;return [index===0?true:typeof initial==='function'?initial():initial,(value:any)=>changes.push({index,value})];},
      useTransition:()=>[false,(run:any)=>run()],useEffect:()=>{},useRef:()=>({current:null}),useCallback:(fn:any)=>fn,useId:()=>'test-form'},
    'react/jsx-runtime':require('react/jsx-runtime'), '@/utils/supabase/client':{},
    'next/image':{__esModule:true,default:()=>null}, './SearchableSelect':{__esModule:true,default:({name,id,defaultValue}:any)=>React.createElement('input',{id,name,defaultValue})},
    './MultiSelect':{__esModule:true,default:()=>null},
    './StudentProfileDialog':{StudentProfileDialog:({children}:any)=>{form=children;return children;},StudentProfileSections:presentation.StudentProfileSections},
    'react-toastify':{toast:{promise:(p:Promise<any>)=>{promise=p;p.catch(()=>{});}}},
    'framer-motion':{AnimatePresence:({children}:any)=>children,motion:{div:'div'}},
    '@/lib/crudActions':formActions,'lucide-react':require('lucide-react'),
    '@/lib/translations/LanguageContext':language,'./ProofViewerModal':{ProofViewerModal:()=>null},'@/lib/imageCompression':{},
  },{FormData:class {values:Record<string,string>;constructor(target:any){this.values=target.values;}get(key:string){return this.values[key]??null;}getAll(key:string){return this.values[key]?[this.values[key]]:[];}}}).default;
  const render=(data:any,mode='update')=>{stateIndex=0;changes.length=0;return renderToStaticMarkup(React.createElement(modal,{entity:'student',mode,id:'student-a',data,relatedData:{classId:[{value:'6',label:'Demo class'}]}}));};
  let markup=render({...base,nationalId:'0012345678'});
  assert.match(markup,/Identifiant unique/);assert.match(markup,/value="0012345678"/);
  assert.match(markup,/name="nationalId"/);assert.match(markup,/Identité de l’élève/);
  assert.match(markup,/Scolarité et responsable/);assert.match(markup,/Coordonnées/);assert.match(markup,/Frais de scolarité/);
  assert.match(markup,/aria-describedby="test-form-nationalId-hint"/);
  assert.match(markup,/min-h-0 flex-1 overflow-y-auto/);assert.match(markup,/shrink-0 border-t/);
  assert.doesNotMatch(markup.match(/<input[^>]*name="nationalId"[^>]*>/)![0],/required/);
  for (const loc of ['en','ar']) {locale=loc;markup=render({...base,nationalId:null});assert.match(markup,/name="nationalId"/);}
  locale='fr';render({...base,nationalId:null},'create');
  const input={values:{name:'Demo',surname:'Student',sex:'MALE',classId:'6',parentId:'parent-a',nationalId:' 0012345678 '}};
  form.props.onSubmit({preventDefault(){},currentTarget:input});
  assert.equal(changes.some(c=>c.index===0&&c.value===false),false,'Do not close student form optimistically');
  await promise!;assert.equal(submitted.nationalId,'0012345678');
  assert.equal(changes.some(c=>c.index===0&&c.value===false),true,'Close only after successful save');
  render(base);fail=true;input.values.nationalId='';form.props.onSubmit({preventDefault(){},currentTarget:input});
  await assert.rejects(promise!);assert.equal(submitted.nationalId,null,'Clearing the field explicitly sends null');
  assert.equal(changes.some(c=>c.index===0&&c.value===false),false,'Failure leaves the form open');
  assert.equal(changes.some(c=>c.value==='Synthetic save failure'),true,'Server error stays visible');
  console.log('Student profile checks passed: optional identifier, leading zeroes, add/change/clear/preserve, admin and school authorization, protected relations, translated sections, accessible labels, fixed footer and save failure retention. Synthetic data only.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
