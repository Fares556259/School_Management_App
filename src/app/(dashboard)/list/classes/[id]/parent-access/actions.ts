"use server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getStudentAdminSchool } from "@/lib/studentProfile";
import { parentSlipCode } from "@/lib/parentSlipCode";
import { revalidatePath } from "next/cache";
import { invalidateTenantTags } from "@/lib/cache";
export async function prepareClassParentSlips(classId:number){
 try{
  const schoolId=await getStudentAdminSchool();
  if(!Number.isInteger(classId))throw new Error("Classe invalide.");
  const activeClass=await prisma.class.findFirst({where:{id:classId,schoolId},select:{id:true,name:true,School:{select:{name:true}},students:{where:{schoolId},select:{id:true,name:true,surname:true,parentId:true},orderBy:[{surname:"asc"},{name:"asc"}]}}});
  if(!activeClass)throw new Error("Classe introuvable.");
  // Do not activate accounts if the login rate-limit dependency is missing.
  try { await prisma.mobileRateLimit.findFirst({select:{key:true}}); } catch { throw new Error("La table MobileRateLimit doit être installée avant de préparer les accès mobiles."); }
  const ids=[...new Set(activeClass.students.flatMap(s=>s.parentId?[s.parentId]:[]))];
  const parents=await prisma.parent.findMany({where:{id:{in:ids},schoolId},select:{id:true,name:true,surname:true,phone:true,password:true,accessStatus:true}});
  const secret=process.env.PARENT_SLIP_SECRET||process.env.JWT_SECRET||"";
  // Derive once per guardian and hash before the transaction; reprints do not reset passwords.
  const prepared=await Promise.all(parents.map(async parent=>{
   const code=parentSlipCode(secret,schoolId,parent.id);
   const ownCode=parent.password?await bcrypt.compare(code,parent.password):false;
   const printable=(!parent.password||ownCode)&&/^(?:\+?216)?[0-9]{8}$/.test(parent.phone)&&["PENDING","ACTIVE"].includes(parent.accessStatus);
   return {parent,code,printable,hash:printable&&!parent.password?await bcrypt.hash(code,12):null};
  }));
  await prisma.$transaction(async tx=>{
   for(const item of prepared){
    if(item.hash){const result=await tx.parent.updateMany({where:{id:item.parent.id,schoolId,password:null,accessStatus:{in:["PENDING","ACTIVE"]}},data:{password:item.hash,accessStatus:"ACTIVE"}});if(result.count!==1)throw new Error("Un compte a changé. Rechargez avant de générer les fiches.");}
    else if(item.printable&&item.parent.accessStatus!=="ACTIVE")await tx.parent.updateMany({where:{id:item.parent.id,schoolId,password:item.parent.password,accessStatus:"PENDING"},data:{accessStatus:"ACTIVE"}});
   }
  },{timeout:20000});
  const byParent=new Map(prepared.map(item=>[item.parent.id,item]));
  revalidatePath("/list/parents");invalidateTenantTags(schoolId,"parents");
  return {success:true as const,school:activeClass.School.name,className:activeClass.name,cards:activeClass.students.map(student=>{
   const item=student.parentId?byParent.get(student.parentId):undefined;
   return {studentId:student.id,studentName:`${student.name} ${student.surname}`,parentName:item?`${item.parent.name} ${item.parent.surname}`.trim():"",phone:item?.parent.phone||"",code:item?.printable?item.code:null,status:!item?"Aucun responsable lié":!item.printable?"Compte existant ou suspendu : contacter l’administration":"Accès prêt"};
  })};
 }catch(e){return {success:false as const,error:e instanceof Error?e.message:"Préparation des fiches échouée"};}
}
