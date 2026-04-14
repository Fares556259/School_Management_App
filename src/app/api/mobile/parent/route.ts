import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("id");
  if (!parentId) return NextResponse.json({});
  
  const parent = await prisma.parent.findUnique({
    where: { id: parentId }
  });
  return NextResponse.json({ name: parent?.name, surname: parent?.surname });
}
