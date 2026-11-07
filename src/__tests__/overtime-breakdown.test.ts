import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendOvertimeLine, overtimeLinesFromHistory } from '../lib/overtimeBreakdown';
import { attachOvertimeLines } from '../lib/teacherOvertimeBreakdown';
const a = (hours: number, rate: number | null, entry?: object, beforeHours = 0, beforeRate: number | null = null) => ({ oldValues: { hours: beforeHours, rate: beforeRate }, newValues: { hours, rate, entry } });
test('Different hourly rates stay separate, the same rate combines and fixed additions never create hours', () => {
 const history = [a(3,10,{mode:'hourly',hours:3,rate:10}), a(7,110/7,{mode:'hourly',hours:4,rate:20},3,10), a(7,110/7,{mode:'fixed',amount:135},7,110/7),a(9,130/9,{mode:'hourly',hours:2,rate:10},7,110/7)];
 assert.deepEqual(overtimeLinesFromHistory({overtimeHours:9,overtimeRate:130/9},history),[{hours:5,rate:10,amount:50},{hours:4,rate:20,amount:80}]);
});
test('Reset clears rate lines; a later addition starts a new breakdown',()=>{
 const history = [a(3,10,{mode:'hourly',hours:3,rate:10}),a(0,0,{mode:'reset'},3,10),a(4,20,{mode:'hourly',hours:4,rate:20})];
 assert.deepEqual(overtimeLinesFromHistory({overtimeHours:4,overtimeRate:20},history),[{hours:4,rate:20,amount:80}]);
});
test('Old totals with no exact history are explicitly historical and never fabricate an hourly rate',()=>{
 const current={overtimeHours:55,overtimeRate:1845/55};
 assert.deepEqual(overtimeLinesFromHistory(current,[]),[{hours:55,rate:null,amount:1845,legacy:true}]);
 const history=[a(58,1875/58,{mode:'hourly',hours:3,rate:10},55,1845/55)];
 assert.deepEqual(overtimeLinesFromHistory({overtimeHours:58,overtimeRate:1875/58},history),[{hours:55,rate:null,amount:1845,legacy:true},{hours:3,rate:10,amount:30}]);
});
test('Incomplete or inconsistent history cannot be presented as an exact breakdown',()=>{
 const history=[a(3,10,{mode:'hourly',hours:3,rate:10})];
 assert.equal(overtimeLinesFromHistory({overtimeHours:7,overtimeRate:110/7},history)[0].legacy,true);
 const bad={newValues:{hours:7,rate:110/7,hourlyLines:[{hours:7,rate:10,amount:70}]}};
 assert.equal(overtimeLinesFromHistory({overtimeHours:7,overtimeRate:110/7},[bad])[0].legacy,true);
});
test('Saved breakdowns round-trip with millime amounts, independent of a later base rate change',()=>{
 const lines=appendOvertimeLine([],1.25,10.1);
 const audit={newValues:{hours:1.25,rate:10.1,hourlyLines:lines}};
 assert.deepEqual(overtimeLinesFromHistory({overtimeHours:1.25,overtimeRate:10.1},[audit],99),[{hours:1.25,rate:10.1,amount:12.625}]);
});
test('Rate histories are read once in the requested school and assigned to the right payment',async()=>{
 let calls=0;
 const db:any={auditLog:{findMany:async({where,orderBy}:any)=>{calls++;assert.equal(where.schoolId,'school-a');assert.equal(where.entityType,'TeacherOvertime');assert.deepEqual(where.entityId.in,['1','2']);assert.deepEqual(orderBy,{id:'asc'});return [{entityId:'1',...a(3,10,{mode:'hourly',hours:3,rate:10})},{entityId:'2',...a(4,20,{mode:'hourly',hours:4,rate:20})}]}}};
 const rows=await attachOvertimeLines('school-a',[{id:1,schoolId:'school-a',overtimeHours:3,overtimeRate:10},{id:2,schoolId:'school-a',overtimeHours:4,overtimeRate:20},{id:3,schoolId:'school-b',overtimeHours:2,overtimeRate:15}],db);
 assert.equal(calls,1);assert.equal(rows[0].overtimeLines[0].amount,30);assert.equal(rows[1].overtimeLines[0].amount,80);assert.deepEqual(rows[2].overtimeLines,[]);
});

test('Legacy hours with a missing saved rate retain the real default-rate amount',async()=>{
 const rows=await attachOvertimeLines('school-a',[{id:1,overtimeHours:3,overtimeRate:null}],{auditLog:{findMany:async()=>[]}} as any,15);
 assert.deepEqual(rows[0].overtimeLines,[{hours:3,rate:null,amount:45,legacy:true}]);
});
