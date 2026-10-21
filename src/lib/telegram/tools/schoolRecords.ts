import prisma from '@/lib/prisma';
import type { ToolContext } from './readTools';
import { resolveClassByName } from './classResolver';
import { schoolDayRange, schoolMonth, roundMoney } from '@/lib/agent/dataAccuracy';

type RecordDefinition = { model: string; label: string; fields: string[]; search?: string[]; date?: string; classPath?: string; status?: string; sum?: string; avg?: string; personRelations?: string[]; nameRelations?: string[] };
const directory = ['id','name','surname','phone','address','createdAt'];
// Public school business fields only. No model name, select, SQL or credentials can be supplied by the model.
export const SCHOOL_RECORDS: Record<string, RecordDefinition> = {
  students: { model:'student', label:'Élèves', fields:[...directory,'classId','levelId','parentId','customTuition','nationalId'], search:['name','surname','phone','nationalId'], date:'createdAt', classPath:'classId', personRelations:['parent'], nameRelations:['class'] },
  parents: { model:'parent', label:'Parents', fields:[...directory,'accessStatus'], search:['name','surname','phone'], date:'createdAt', status:'accessStatus' },
  teachers: { model:'teacher', label:'Enseignants', fields:[...directory,'salary','hourlyRate','hoursPerMonth'], search:['name','surname','phone'], date:'createdAt' },
  staff: { model:'staff', label:'Personnel', fields:[...directory,'role','salary'], search:['name','surname','phone','role'], date:'createdAt' },
  classes: { model:'class', label:'Classes', fields:['id','name','capacity','levelId','supervisorId'], search:['name'], classPath:'id' },
  levels: { model:'level', label:'Niveaux et tarifs', fields:['id','level','tuitionFee','variations'] },
  subjects: { model:'subject', label:'Matières', fields:['id','name','domain','parentId'], search:['name','domain'] },
  rooms: { model:'room', label:'Salles', fields:['id','name'], search:['name'] },
  lessons: { model:'lesson', label:'Cours', fields:['id','name','day','startTime','endTime','classId','teacherId','subjectId'], search:['name'], date:'startTime', classPath:'classId', personRelations:['teacher'], nameRelations:['class','subject'] },
  timetable: { model:'timetableSlot', label:'Emploi du temps', fields:['id','day','startTime','endTime','classId','teacherId','subjectId','roomId','isDraft','groupId'], classPath:'classId', personRelations:['teacher'], nameRelations:['class','subject','room'] },
  exams: { model:'exam', label:'Examens', fields:['id','title','startTime','endTime','lessonId','examPeriod','isDraft'], search:['title'], date:'startTime', classPath:'lesson.classId' },
  assignments: { model:'assignment', label:'Devoirs', fields:['id','title','description','startDate','dueDate','lessonId'], search:['title','description'], date:'dueDate', classPath:'lesson.classId' },
  resources: { model:'resource', label:'Supports de cours', fields:['id','title','description','url','lessonId','createdAt'], search:['title','description'], date:'createdAt', classPath:'lesson.classId' },
  grades: { model:'grade', label:'Notes', fields:['id','score','studentId','subjectId','term','createdAt'], date:'createdAt', classPath:'student.classId', avg:'score', personRelations:['student'], nameRelations:['subject'] },
  grade_sheets: { model:'gradeSheet', label:'Relevés de notes', fields:['id','classId','subjectId','teacherId','term','notes','createdAt'], search:['notes'], date:'createdAt', classPath:'classId', personRelations:['teacher'], nameRelations:['class','subject'] },
  results: { model:'result', label:'Résultats et remises', fields:['id','score','studentId','examId','assignmentId','submittedAt'], date:'submittedAt', classPath:'student.classId', avg:'score', personRelations:['student'] },
  attendance: { model:'attendance', label:'Présences (enregistrements par séance)', fields:['id','studentId','lessonId','date','status','note','justificationStatus','justificationNote'], search:['note'], date:'date', classPath:'student.classId', status:'status', personRelations:['student'] },
  payments: { model:'payment', label:'Règlements (mois de scolarité/paie)', fields:['id','amount','month','year','status','userType','paidAt','studentId','teacherId','staffId','deferredAmount','deferredUntil'], date:'paidAt', classPath:'student.classId', status:'status', sum:'amount', personRelations:['student','teacher','staff'] },
  incomes: { model:'income', label:'Recettes encaissées (registre)', fields:['id','title','amount','category','date','referenceType','referenceId'], search:['title','category'], date:'date', sum:'amount' },
  expenses: { model:'expense', label:'Dépenses (registre)', fields:['id','title','amount','category','date','referenceType','referenceId'], search:['title','category'], date:'date', sum:'amount' },
  announcements: { model:'notice', label:'Annonces', fields:['id','title','message','date','important','classId','targetStudentId'], search:['title','message'], date:'date', classPath:'classId', nameRelations:['class'] },
  notifications: { model:'notification', label:'Notifications aux parents', fields:['id','parentId','studentId','type','title','message','isRead','createdAt'], search:['title','message'], date:'createdAt', classPath:'student.classId', personRelations:['parent','student'] },
  parent_requests: { model:'parentAccessRequest', label:'Demandes des parents', fields:['id','parentId','studentId','relation','status','reason','createdAt','reviewedAt'], search:['reason'], date:'createdAt', classPath:'student.classId', status:'status', personRelations:['parent','student'] },
  settings: { model:'institution', label:'Paramètres de l’établissement', fields:['id','schoolName','phone','address','academicYear','currentSemester','dayStartTime','dayEndTime','yearStart','yearEnd'] },
  exam_periods: { model:'examPeriodConfig', label:'Périodes des examens', fields:['id','period','startDate','endDate','classId'], date:'startDate', classPath:'classId' },
  school_rules: { model:'aIKnowledge', label:'Consignes mémorisées', fields:['id','category','instruction','isActive','createdAt'], search:['instruction','category'], date:'createdAt' },
  audit: { model:'auditLog', label:'Journal d’audit', fields:['id','action','performedBy','entityType','entityId','description','timestamp','amount','effectiveDate'], search:['action','description','entityType'], date:'timestamp' },
};

export interface SchoolRecordsArgs {
  entity: string; query?: string; className?: string; recordId?: string;
  status?: string; userType?: string; month?: number; year?: number;
  dateFrom?: string; dateTo?: string; term?: number; limit?: number; offset?: number;
}
export async function querySchoolRecords(args: SchoolRecordsArgs, context: ToolContext) {
  try {
    if (!context.schoolId || !Object.prototype.hasOwnProperty.call(SCHOOL_RECORDS,args.entity)) throw new Error('Catégorie de données indisponible.');
    const def = SCHOOL_RECORDS[args.entity];
    const where: any = { schoolId: context.schoolId };
    const limit = Math.max(1,Math.min(Number.isInteger(args.limit) ? args.limit! : 50,100));
    const offset = Math.max(0,Math.min(Number.isInteger(args.offset) ? args.offset! : 0,100000));
    if (args.query) {
      if (!def.search?.length) throw new Error('Utilisez un identifiant exact pour rechercher dans cette catégorie.');
      if (typeof args.query !== 'string' || args.query.length > 256) throw new Error('Recherche invalide.');
      where.OR=def.search.map(field=>({[field]:{contains:args.query!.trim(),mode:'insensitive'}}));
    }
    if (args.recordId !== undefined) {
      if (typeof args.recordId !== 'string' || !args.recordId.trim()) throw new Error('Identifiant invalide.');
      where.id=['student','parent','teacher','staff','parentAccessRequest','aIKnowledge'].includes(def.model) ? args.recordId : Number(args.recordId);
      if (typeof where.id==='number' && (!Number.isSafeInteger(where.id) || where.id < 1)) throw new Error('Identifiant numérique invalide.');
    }
    if (args.className) {
      if (!def.classPath) throw new Error('Le filtre classe ne s’applique pas à cette catégorie.');
      const target = await resolveClassByName(context.schoolId,args.className);
      if (!target) throw new Error(`Classe « ${args.className} » introuvable ou ambiguë. Précisez son nom exact.`);
      const parts=def.classPath.split('.'); let branch=where;
      for (const part of parts.slice(0,-1)) branch=branch[part] || (branch[part]={schoolId:context.schoolId});
      branch[parts[parts.length-1]]=target.id;
    }
    if (args.status) {
      if (!def.status) throw new Error('Ce type de données ne possède pas de statut filtrable.');
      where[def.status]=args.status.toUpperCase();
    }
    if (args.userType) {
      if (def.model!=='payment' || !['STUDENT','TEACHER','STAFF'].includes(args.userType.toUpperCase())) throw new Error('Type de règlement invalide.');
      where.userType={equals:args.userType,mode:'insensitive'};
    }
    if (args.term!==undefined) {
      if (!def.fields.includes('term') || !Number.isInteger(args.term) || args.term<1 || args.term>3) throw new Error('Trimestre invalide.');
      where.term=args.term;
    }
    if (args.month!==undefined || args.year!==undefined) {
      const period=schoolMonth(args.month,args.year);
      if (def.model==='payment') Object.assign(where,{...(args.month!==undefined?{month:period.month}:{}),year:period.year});
      else if (def.date) where[def.date]=args.month===undefined ? {gte:schoolDayRange(`${period.year}-01-01`).gte,lt:schoolDayRange(`${period.year+1}-01-01`).gte} : period.range;
      else throw new Error('Le filtre mensuel ne s’applique pas à cette catégorie.');
    }
    if (args.dateFrom || args.dateTo) {
      if (!def.date) throw new Error('Le filtre de dates ne s’applique pas à cette catégorie.');
      const range={...(where[def.date] || {}),...(args.dateFrom?{gte:schoolDayRange(args.dateFrom).gte}:{}),...(args.dateTo?{lt:schoolDayRange(args.dateTo).lt}:{})};
      if (where[def.date]?.gte && range.gte < where[def.date].gte) range.gte = where[def.date].gte;
      if (where[def.date]?.lt && range.lt > where[def.date].lt) range.lt = where[def.date].lt;
      if (range.gte && range.lt && range.gte>=range.lt) throw new Error('La date de fin précède la date de début.');
      where[def.date]=range;
    }
    const select: any=Object.fromEntries(def.fields.map(field=>[field,true]));
    for (const relation of def.personRelations || []) select[relation]={select:{name:true,surname:true,schoolId:true}};
    for (const relation of def.nameRelations || []) select[relation]={select:{name:true,schoolId:true}};
    const delegate=(prisma as any)[def.model];
    const sumField = def.model === 'payment' && !['PAID','PARTIAL'].includes(where.status) ? undefined : def.sum;
    const [total,rawRecords,aggregates]=await Promise.all([
      delegate.count({where}),
      delegate.findMany({where,select,take:limit,skip:offset,orderBy:def.date?[{[def.date]:'desc'},{id:'asc'}]:[{id:'asc'}]}),
      sumField || def.avg ? delegate.aggregate({where,...(sumField?{_sum:{[sumField]:true}}:{}),...(def.avg?{_avg:{[def.avg]:true}}:{})}) : Promise.resolve(null),
    ]);
    const records=rawRecords.map((row:any)=>{
      const clean={...row};
      for (const relation of [...(def.personRelations||[]),...(def.nameRelations||[])]) {
        const value=clean[relation];
        clean[relation]=value?.schoolId===context.schoolId ? Object.fromEntries(Object.entries(value).filter(([key])=>key!=='schoolId')) : null;
      }
      return clean;
    });
    const fetchedAt=new Date().toISOString();
    const hasMore=offset+records.length<total;
    const summary=aggregates?{...(sumField?{totalAmount:roundMoney(aggregates._sum?.[sumField]??0)}:{}),...(def.avg?{averageScore:aggregates._avg?.[def.avg]??null}:{})}:{};
    const filters=Object.fromEntries(Object.entries(args).filter(([key])=>!['limit','offset'].includes(key)));
    const textRows=records.map((row:any,index:number)=>{
      const title=[row.name,row.surname].filter(Boolean).join(' ') || row.title || row.schoolName || row.instruction || (row.level!==undefined?`Niveau ${row.level}`:def.label);
      const details=Object.entries(row).filter(([key,value])=>value!==null && value!==undefined && !['id','name','surname','title','schoolName','instruction'].includes(key) && !key.endsWith('Id')).map(([key,value])=>`${key}: ${typeof value==='object' ? value instanceof Date?value.toISOString():Object.values(value as object).join(' ') : value}`).join(' · ');
      return `${offset+index+1}. **${title}**${details?` — ${details}`:''}`;
    }).join('\n');
    const formattedText=`**${def.label} — ${total} résultat(s)**\n${Object.entries(filters).filter(([key])=>key!=='entity').map(([key,value])=>`${key} : ${value}`).join(' · ')}\n`+
      (summary.totalAmount!==undefined?`Total de tous les résultats filtrés : **${summary.totalAmount} DT**\n`:'')+
      (summary.averageScore!==undefined?`Moyenne des résultats filtrés : **${summary.averageScore??'Non disponible'}**\n`:'')+
      `\n${textRows || 'Aucun enregistrement correspondant.'}\n\n**${records.length} affiché(s) sur ${total}**${hasMore?' — dites « page suivante » pour continuer.':' — fin des résultats.'}`;
    return {success:true,source:'school_database',entity:args.entity,filters,fetchedAt,total,returned:records.length,offset,hasMore,nextOffset:hasMore?offset+records.length:null,summary,records,formattedText};
  } catch(error:any) {
    return {success:false,error:true,message:error.message || 'La vérification des données a échoué. Aucun résultat vérifié disponible.'};
  }
}
