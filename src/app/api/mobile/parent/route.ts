import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("id");
  
  if (!parentId) return NextResponse.json({});
  
  console.log("[API] Fetching mobile parent profile for ID:", parentId);

  const parent = await prisma.parent.findUnique({
    where: { id: parentId }
  });

  const schoolConfig = await prisma.schoolConfig.findFirst({ where: { id: 1 } });

  return NextResponse.json({ 
    name: parent?.name, 
    surname: parent?.surname,
    schoolInfo: schoolConfig 
  });
}
