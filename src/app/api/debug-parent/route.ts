import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const p = await prisma.parent.findUnique({
    where: { email: "parent1@gmail.com" },
    include: { students: true }
  });
  return NextResponse.json(p);
}
