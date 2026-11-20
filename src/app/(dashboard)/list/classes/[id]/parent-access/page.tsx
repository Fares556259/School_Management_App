import prisma from "@/lib/prisma";
import { getStudentAdminSchool } from "@/lib/studentProfile";
import { notFound } from "next/navigation";
import ParentAccessSlips from "./slips";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const schoolId=await getStudentAdminSchool();const {id}=await params;
 const target=await prisma.class.findFirst({where:{id:Number(id),schoolId},select:{id:true,name:true,students:{where:{schoolId},select:{id:true,name:true,surname:true,parent:{select:{name:true,surname:true,phone:true,accessStatus:true}}},orderBy:[{surname:"asc"},{name:"asc"}]}}});
 if(!target)notFound();
 return <ParentAccessSlips target={target}/>;
}
