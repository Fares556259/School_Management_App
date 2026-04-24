export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const parents = await prisma.parent.findMany({ select: { name: true, surname: true, email: true, username: true } });
  const admins = await prisma.admin.findMany({ select: { name: true, surname: true, email: true, username: true } });
  
  return NextResponse.json({
    real_parents: parents.filter(p => !p.username.startsWith("parent")),
    admins: admins
  });
}
