"use server";

import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { auth } from "@clerk/nextjs/server";
import { getRole } from "@/lib/role";

export async function getReceiptContext() {
  try {
    const schoolId = await getSchoolId();
    const { userId } = auth();
    const role = await getRole();

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true }
    });

    let adminName = "Administration";
    if (role === "admin" && userId) {
      const admin = await prisma.admin.findUnique({
        where: { id: userId },
        select: { name: true, surname: true }
      });
      if (admin) {
        adminName = `${admin.name} ${admin.surname}`;
      }
    }

    return {
      schoolName: school?.name || "SnapSchool",
      adminName
    };
  } catch (error) {
    console.error("Error fetching receipt context:", error);
    return {
      schoolName: "SnapSchool",
      adminName: "Administration"
    };
  }
}
