import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(classes);
  } catch (error: any) {
    console.error("[Classes GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
