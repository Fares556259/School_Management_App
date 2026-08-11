import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("id");

  if (!parentId) return NextResponse.json({});

  // Enforce ownership: a parent can only fetch their own profile
  if (userType !== "parent" || userId !== parentId) {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  console.log("[API] Fetching mobile parent profile for ID:", parentId);

  const parent = await prisma.parent.findUnique({
    where: { id: parentId, schoolId },
  });

  const schoolConfig = await prisma.institution.findFirst({
    where: { schoolId: parent?.schoolId || schoolId },
    select: {
      schoolName: true,
      schoolLogo: true,
      ministryName: true,
      ministryLogo: true,
      universityName: true,
      universityLogo: true,
      academicYear: true,
      currentSemester: true,
      sessions: true,
      holidays: true,
      yearStart: true,
      yearEnd: true,
    },
  });

  return NextResponse.json({
    name: parent?.name,
    surname: parent?.surname,
    phone: parent?.phone,
    img: parent?.img,
    schoolInfo: schoolConfig,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType } = auth.payload;

  try {
    const { id, name, surname, phone, img } = await request.json();

    if (!id) {
      return new NextResponse("Missing parent ID", { status: 400 });
    }

    // Enforce ownership: a parent can only update their own profile
    if (userType !== "parent" || userId !== id) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const updatedParent = await prisma.parent.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(surname && { surname }),
        ...(phone && { phone }),
        img: img !== undefined ? (img || null) : undefined,
      },
    });

    return NextResponse.json(updatedParent);
  } catch (error: any) {
    console.error("[Mobile Parent Update Error]", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
