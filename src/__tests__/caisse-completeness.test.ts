import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import prisma from '../lib/prisma';
import {generateToken} from '../lib/mobileAuth';
import {GET,POST} from '../app/api/mobile/admin/caisse/route';
async function main(){
 const original=process.env.JWT_SECRET;process.env.JWT_SECRET='caisse-test-only-secret-longer-than-32-characters';
 const undo:Array<()=>void>=[];
 const replace=(object:any,key:string,value:any)=>{const old=object[key];object[key]=value;undo.push(()=>object[key]=old);};
 const token=generateToken({userId:'qa-admin',userType:'admin',schoolId:'school-a'});
 const req=(query='',body?:any)=>new NextRequest('https://example.com/api/mobile/admin/caisse'+query,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 let dataCalls=0;
 replace(prisma.admin,'findFirst',async()=>({id:'qa-admin'}));
 for(const [model,total]of [[prisma.income,1234],[prisma.expense,456]] as const){
  replace(model,'aggregate',async({where}:any)=>{dataCalls++;assert.equal(where.schoolId,'school-a');return {_sum:{amount:total}};});
  replace(model,'findMany',async({where,distinct}:any)=>{dataCalls++;assert.equal(where.schoolId,'school-a');return distinct?[]:Array.from({length:50},(_,i)=>({id:i,title:'QA',amount:1,date:new Date(),category:'QA'}));});
 }
 replace(prisma,'$queryRaw',async(parts:any,...values:any[])=>{
  dataCalls++;assert(values.includes('school-a'));assert(values.includes(10));assert(values.includes(2026));
  const sql=parts.join('');assert(!/LIMIT\s+100/.test(sql),'Outstanding records cannot silently truncate');
  if(sql.includes('FROM "Student"'))return Array.from({length:130},(_,i)=>({id:'child-'+i,name:'QA',surname:String(i),tuitionFee:i===0?0:200,paidAmount:0}));
  if(sql.includes('FROM "Teacher"'))return [{id:'teacher',name:'QA',surname:'Teacher',salary:0,hourlyRate:0,hoursPerMonth:0}];
  return [{id:'staff',name:'QA',surname:'Staff',salary:0}];
 });
 try{
  for(const query of ['?month=13','?month=0','?month=abc','?year=bad','?year=2026.5'])assert.equal((await GET(req(query))).status,400);
  for(const body of [{month:13},{year:0},{month:'bad'}])assert.equal((await POST(req('',{action:'collect_student',studentId:'x',amount:5,...body}))).status,400);
  assert.equal(dataCalls,0);
  const r=await GET(req('?month=10&year=2026'));assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
  const d=await r.json();assert.equal(d.unpaidStudents.length,130);assert.equal(d.summary.unpaidStudentsTotal,25800);
  assert.equal(d.summary.todayIncome,1234);assert.equal(d.summary.todayExpense,456);assert.equal(d.summary.todayNet,778);
  assert.equal(d.unpaidStudents[0].dueAmount,0);assert.equal(d.unpaidTeachers[0].dueAmount,0);assert.equal(d.unpaidStaff[0].dueAmount,0);
  console.log('Cash: 130 students, full ledger totals beyond 50-row preview, zero fees/salaries, period validation, tenant scope and no-store.');
 }finally{undo.reverse().forEach(fn=>fn());if(original===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=original;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
