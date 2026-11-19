import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { type Extraction } from "./schema";
import { preparePdfImport } from "./prepare";

export async function commitPdfImport(schoolId: string, extraction: Extraction, birthdays: Record<string,string>) {
  const prepared = preparePdfImport(extraction, birthdays);
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('student-national-id'), hashtext(${schoolId}))`;
    // Shared phones have a global unique constraint; serialize parent reuse across schools.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pdf-parent-import'))`;
    const levels = await tx.level.findMany({where:{schoolId}});
    const levelIds = new Map(levels.map(level => [level.level,level.id]));
    const missing = [...new Set(prepared.students.map(s=>s.grade))].filter(grade=>!levelIds.has(grade));
    if (missing.length) throw new Error(`Créez d’abord les niveaux manquants dans cette école : ${missing.map(g=>g===0?"Préparatoire":g).join(", ")}.`);
    const existingParents = await tx.parent.findMany({where:{phone:{in:[...prepared.parents.keys()]}}});
    const parentIds = new Map<string,string>();
    for (const parent of existingParents) {
      const fullName = parent.surname ? `${parent.name} ${parent.surname}` : parent.name;
      if (parent.schoolId !== schoolId || fullName !== prepared.parents.get(parent.phone)) throw new Error(`Le responsable lié au téléphone ${parent.phone} nécessite une vérification. Aucun enregistrement modifié.`);
      parentIds.set(parent.phone,parent.id);
    }
    const newParents = [...prepared.parents].filter(([phone])=>!parentIds.has(phone)).map(([phone,name])=>{
      const id=randomUUID();parentIds.set(phone,id);
      // Keep the full source name without guessing the first/surname split.
      return {id,username:`pdf_parent_${id}`,name,surname:"",phone,address:"",schoolId,accessStatus:"PENDING",password:null};
    });
    if(newParents.length) await tx.parent.createMany({data:newParents});
    const existingStudents = await tx.student.findMany({where:{schoolId,nationalId:{in:prepared.students.map(s=>s.nationalId)}}});
    const existingById = new Map(existingStudents.map(s=>[s.nationalId,s]));
    const targets = prepared.students.map(source=>({name:source.name,surname:source.surname,nationalId:source.nationalId,sex:source.sex,birthday:source.birthday,parentId:parentIds.get(source.guardianPhone)!,levelId:levelIds.get(source.grade)!,schoolId,classId:null,address:"",bloodType:""}));
    const matches = (actual: typeof existingStudents[number], expected: typeof targets[number]) => actual.name===expected.name && actual.surname===expected.surname && actual.sex===expected.sex && (!expected.birthday || actual.birthday?.toISOString()===expected.birthday.toISOString()) && actual.parentId===expected.parentId && actual.levelId===expected.levelId && actual.schoolId===schoolId;
    for(const target of targets){const existing=existingById.get(target.nationalId);if(existing&&!matches(existing,target)) throw new Error(`L’élève ${target.nationalId} existe avec des informations différentes. Aucun enregistrement modifié.`);}
    const newStudents=targets.filter(t=>!existingById.has(t.nationalId)).map(t=>{const id=randomUUID();return {...t,id,username:`pdf_student_${id}`};});
    if(newStudents.length) await tx.student.createMany({data:newStudents});
    const saved=await tx.student.findMany({where:{schoolId,nationalId:{in:targets.map(t=>t.nationalId)}}});
    if(saved.length!==targets.length || targets.some(t=>!saved.some(s=>s.nationalId===t.nationalId&&matches(s,t))))throw new Error("La vérification après enregistrement a échoué. Import annulé.");
    for (const expected of newStudents) {
      const actual = saved.find(student => student.id === expected.id);
      if (!actual || actual.username !== expected.username || actual.address !== "" || actual.bloodType !== "" || actual.classId !== null) throw new Error("Vérification des nouveaux élèves échouée. Import annulé.");
    }
    const savedParents=await tx.parent.findMany({where:{id:{in:[...parentIds.values()]}}});
    if(savedParents.length!==parentIds.size || savedParents.some(p=>p.schoolId!==schoolId||(p.surname?`${p.name} ${p.surname}`:p.name)!==prepared.parents.get(p.phone)))throw new Error("Vérification des responsables échouée. Import annulé.");
    for (const expected of newParents) {
      const actual = savedParents.find(parent => parent.id === expected.id);
      if (!actual || actual.name !== expected.name || actual.surname !== "" || actual.username !== expected.username || actual.address !== "" || actual.accessStatus !== "PENDING" || actual.password !== null) throw new Error("Vérification des nouveaux responsables échouée. Import annulé.");
    }
    return {createdStudents:newStudents.length,existingStudents:existingStudents.length,createdParents:newParents.length,reusedParents:existingParents.length};
  },{maxWait:10000,timeout:120000,isolationLevel:"Serializable"});
}
