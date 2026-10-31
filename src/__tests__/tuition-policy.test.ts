import assert from 'node:assert/strict';
import prisma from '../lib/prisma';
import { tuitionForMonth, tuitionMonthlyBalance } from '../lib/tuitionPolicy';
import { calculateStudentPaymentAllocation } from '../lib/telegram/tools/writeTools';
import { getSchoolYearMonths, MONTHS } from '../lib/dateUtils';

async function main() {
  for (let month = 1; month <= 12; month++) {
    assert.equal(tuitionForMonth(170, month, false), 170);
    assert.equal(tuitionForMonth(170, month, true), [6, 9].includes(month) ? 85 : 170);
  }
  assert.equal(tuitionForMonth(170.123, 9, true), 85.062);
  assert.equal(tuitionForMonth(0, 6, true), 0);
  assert.equal([9,10,11,12,1,2,3,4,5,6].reduce((sum,m)=>sum+tuitionForMonth(170,m,true),0),1530);
  assert.deepEqual(tuitionMonthlyBalance(170,9,true,{status:'PARTIAL',amount:85,deferredAmount:85}), {fee:85,received:85,due:0,status:'PAID'});
  assert.equal(tuitionMonthlyBalance(170,9,false,{status:'PAID',amount:85}).due,85);
  assert.equal(tuitionMonthlyBalance(170,6,true,{status:'PENDING',amount:170}).received,0);
  assert.equal(tuitionMonthlyBalance(170,6,true,{status:'PENDING',amount:170}).due,85);
  assert.equal(tuitionMonthlyBalance(170,9,true,{status:'PARTIAL',amount:30}).due,55);
  assert.throws(()=>tuitionForMonth(-1,9,true)); assert.throws(()=>tuitionForMonth(170,13,true));
  const restores:(()=>void)[]=[];
  const replace=(target:any,key:string,value:any)=>{const old=target[key];target[key]=value;restores.push(()=>target[key]=old);};
  try {
    replace(prisma.institution,'findUnique',async({where}:any)=>{assert.equal(where.schoolId,'school-a');return{halfBoundaryMonths:true};});
    replace(prisma.student,'findFirst',async({where}:any)=>{assert.equal(where.schoolId,'school-a');return{id:'child-a',customTuition:170,level:{tuitionFee:450}};});
    replace(prisma.payment,'findMany',async({where}:any)=>{assert.equal(where.schoolId,'school-a');return[];});
    const months=getSchoolYearMonths(); const first=months[0].split(' '); const year=Number(first[1]);
    const allocation=await calculateStudentPaymentAllocation('child-a',255,'school-a',9,year);
    assert.deepEqual(allocation?.paymentsToProcess.map(p=>[p.month,p.amount,p.status]),[[9,85,'PAID'],[10,170,'PAID']]);
    const june=months.find(key=>key.startsWith(MONTHS[5]+' '))!;
    const end=await calculateStudentPaymentAllocation('child-a',170,'school-a',6,Number(june.split(' ')[1]));
    assert.equal(end?.paymentsToProcess[0].amount,85); assert.equal(end?.unallocatedAmount,85);
    const huge=await calculateStudentPaymentAllocation('child-a',99999,'school-a',9,year);
    assert.equal(huge?.paymentsToProcess.reduce((sum,p)=>sum+p.newMoneyCollected,0),1530);
    console.log('Tuition policy: enable/disable, September/June 50%, eight full months, zero/custom tariffs, millime rounding, pending versus actual cash, stale deferred balances, waterfall allocation and excess protection.');
  } finally {restores.reverse().forEach(restore=>restore());}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
