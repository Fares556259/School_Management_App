export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const parents = await prisma.parent.findMany({ include: { students: true } });
  const slots = await prisma.timetableSlot.findMany();
  const assignments = await prisma.assignment.findMany();

  return NextResponse.json({ parents, slotsCount: slots.length, assignmentsCount: assignments.length });
}
