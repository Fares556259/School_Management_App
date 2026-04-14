import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  await prisma.student.update({
    where: { id: "student1" },
    data: { name: "Amine" }
  });
  await prisma.student.update({
    where: { id: "student2" },
    data: { name: "Youssef" }
  });
  return NextResponse.json({ success: true });
}
