import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { classId, studentId, customStudentName, parentName, parentPhone, relation, email, schoolId } = body;

    if (!classId || (!studentId && !customStudentName) || !parentName || !parentPhone) {
      return NextResponse.json(
        { error: "Veuillez remplir tous les champs obligatoires (Élève, Nom du parent, Téléphone)." },
        { status: 400 }
      );
    }

    const numericClassId = typeof classId === "string" ? parseInt(classId, 10) : classId;

    // Check for existing pending request with same phone & student
    const existing = await prisma.parentRegistrationRequest.findFirst({
      where: {
        classId: numericClassId,
        parentPhone: parentPhone.trim(),
        studentId: studentId || "custom",
        status: "PENDING",
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Une demande d'inscription est déjà en attente de validation pour ce numéro et cet élève." },
        { status: 200 }
      );
    }

    const newRequest = await prisma.parentRegistrationRequest.create({
      data: {
        classId: numericClassId,
        studentId: studentId || "custom",
        studentName: customStudentName || null,
        parentName: parentName.trim(),
        parentPhone: parentPhone.trim(),
        relation: relation || "Père",
        email: email ? email.trim() : null,
        schoolId: schoolId || "default_school",
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      requestId: newRequest.id,
      message: "Votre demande a été soumise avec succès à la direction de l'école.",
    });
  } catch (error: any) {
    console.error("POST /api/join/submit error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la soumission" }, { status: 500 });
  }
}
