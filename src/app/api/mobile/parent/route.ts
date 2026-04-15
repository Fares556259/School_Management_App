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

export async function PATCH(request: NextRequest) {
  try {
    const { id, name, surname, phone, img } = await request.json();

    if (!id) {
      return new NextResponse("Missing parent ID", { status: 400 });
    }

    const updatedParent = await prisma.parent.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(surname && { surname }),
        ...(phone && { phone }),
        ...(img && { img }),
      },
    });

    return NextResponse.json(updatedParent);
  } catch (error: any) {
    console.error("[Mobile Parent Update Error]", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
