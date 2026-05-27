import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = await prisma.parent.findUnique({
    where: { id: "parent1" },
    include: { students: true }
  });
  return NextResponse.json(p);
}
