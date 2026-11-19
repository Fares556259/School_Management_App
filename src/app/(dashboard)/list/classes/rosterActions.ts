"use server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getStudentAdminSchool } from "@/lib/studentProfile";
import { matchClassRoster } from "@/lib/classRoster";
import { revalidatePath } from "next/cache";
import { invalidateTenantTags } from "@/lib/cache";
export async function processClassRoster(classId:number,text:string,expectedCount:number|null,commit=false){
 try{
  const schoolId=await getStudentAdminSchool();
  if(!Number.isInteger(classId)||typeof text!=="string"||text.length>100000)throw new Error("Liste invalide.");
  return await prisma.$transaction(async(tx:Prisma.TransactionClient)=>{
   if(commit)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('class-roster'), ${classId})`;
   const target=await tx.class.findFirst({where:{id:classId,schoolId},select:{id:true,levelId:true,level:{select:{level:true}},capacity:true}});
   if(!target)throw new Error("Classe introuvable.");
   const students=await tx.student.findMany({where:{schoolId},select:{id:true,name:true,surname:true,nationalId:true,classId:true,level:{select:{level:true}}}});
   const rows=matchClassRoster(text,students,classId,target.level.level);
   if(!commit)return {success:true as const,rows};
   if(expectedCount!==rows.length||rows.some(r=>r.error))throw new Error("Corrigez les anomalies et confirmez le nombre exact d’élèves.");
   const selected=rows.map(r=>r.student!.id);
   const current=await tx.student.count({where:{schoolId,classId}});
   const adding=rows.filter(r=>r.student?.classId!==classId).length;
   if(target.capacity>0&&current+adding>target.capacity)throw new Error("La capacité de cette classe serait dépassée.");
   const updated=await tx.student.updateMany({where:{id:{in:selected},schoolId,levelId:target.levelId,OR:[{classId:null},{classId}]},data:{classId}});
   if(updated.count!==selected.length)throw new Error("Une affectation a changé. Rechargez la liste avant de confirmer.");
   const saved=await tx.student.count({where:{id:{in:selected},schoolId,classId,levelId:target.levelId}});
   if(saved!==selected.length)throw new Error("Vérification échouée. Affectation annulée.");
   revalidatePath("/list/students");revalidatePath("/list/classes");revalidatePath(`/list/classes/${classId}`);
   invalidateTenantTags(schoolId,"students");invalidateTenantTags(schoolId,"classes");
   return {success:true as const,assigned:adding,alreadyAssigned:selected.length-adding};
  },{isolationLevel:"Serializable",timeout:20000});
 }catch(e){return {success:false as const,error:e instanceof Error?e.message:"Affectation échouée"};}
}
