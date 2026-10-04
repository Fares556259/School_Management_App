import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;

  const { userId, userType, schoolId } = auth.payload;
  if (userType !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedId = new URL(request.url).searchParams.get("id");
  if (requestedId && requestedId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = await prisma.admin.findFirst({
      where: { id: userId, schoolId, status: "active" },
      select: {
        id: true,
        name: true,
        surname: true,
        username: true,
        email: true,
        phone: true,
        img: true,
        School: { select: { name: true } },
      },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: admin.id,
      name: admin.name || admin.username || "Admin",
      surname: admin.surname || "",
      username: admin.username,
      email: admin.email,
      phone: admin.phone,
      img: admin.img,
      schoolName: admin.School.name,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Mobile Admin Profile] Error:", error);
    return NextResponse.json({ error: "Profile unavailable" }, { status: 500 });
  }
}
