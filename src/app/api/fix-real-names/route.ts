import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  await prisma.parent.update({
    where: { email: "parent1@gmail.com" },
    data: { name: "Fares", surname: "Selmi" }
  });
  
  await prisma.student.update({
    where: { id: "student1" },
    data: { name: "Amine", surname: "Selmi" }
  });
  
  await prisma.student.update({
    where: { id: "student2" },
    data: { name: "Youssef", surname: "Selmi" }
  });

  return NextResponse.json({ success: true });
}
