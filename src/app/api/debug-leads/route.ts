export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const leads = await prisma.setupRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    const admins = await prisma.admin.findMany({
      orderBy: { id: 'desc' },
      take: 10
    });
    return NextResponse.json({ success: true, leads, admins });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
