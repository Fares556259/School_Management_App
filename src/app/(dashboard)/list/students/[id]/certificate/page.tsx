import React from "react";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getSchoolId } from "@/lib/school";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import CertificatePageClient from "./CertificatePageClient";

export const dynamic = "force-dynamic";

interface CertificatePageProps {
  params: {
    id: string;
  };
}

export default async function CertificatePage({ params }: CertificatePageProps) {
  const { id } = params;
  const user = await getAuthenticatedUser();
  if (!user) redirect('/sign-in');
  const schoolId = await getSchoolId();
  const issuer = await prisma.admin.findFirst({where:{id:user.id,schoolId,status:'active'},select:{id:true}});
  if (!issuer) redirect('/sign-in');

  const [student, school, institution, admin] = await Promise.all([
    prisma.student.findFirst({
      where: { id, schoolId },
      include: {
        class: true,
        level: true,
      },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subdomain: true },
    }),
    prisma.institution.findFirst({
      where: { schoolId },
      select: { schoolName: true, ministryName: true, address: true, phone: true },
    }),
    user?.id
      ? prisma.admin.findUnique({
          where: { id: user.id },
          select: { name: true, surname: true },
        })
      : null,
  ]);

  if (!student) {
    notFound();
  }

  const schoolName = institution?.schoolName || school?.name || "المدرسة الابتدائية الخاصة سناب سكول";
  const adminName = admin ? `${admin.name} ${admin.surname}` : "الإدارة";
  const schoolAddress = institution?.address || "";

  return (
    <CertificatePageClient
      student={student}
      schoolName={schoolName}
      adminName={adminName}
      schoolAddress={schoolAddress}
    />
  );
}
