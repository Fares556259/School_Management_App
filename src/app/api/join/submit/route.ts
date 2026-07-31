import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      classId,
      parentName,
      parentSurname,
      parentPhone,
      address,
      relation,
      email,
      children,
      schoolId,
    } = body;

    if (!classId || !parentName || !parentSurname || !parentPhone || !children || !Array.isArray(children) || children.length === 0) {
      return NextResponse.json(
        { error: "Veuillez remplir tous les champs obligatoires (Prénom, Nom, Téléphone et au moins un enfant)." },
        { status: 400 }
      );
    }

    const numericClassId = typeof classId === "string" ? parseInt(classId, 10) : classId;
    const fullParentName = `${parentName.trim()} ${parentSurname.trim()}`;

    // Check for existing pending request with same phone & class
    const existing = await prisma.parentRegistrationRequest.findFirst({
      where: {
        parentPhone: parentPhone.trim(),
        classId: numericClassId,
        status: "PENDING",
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Une demande d'inscription avec ce numéro de téléphone est déjà en attente de validation." },
        { status: 200 }
      );
    }

    const newRequest = await prisma.parentRegistrationRequest.create({
      data: {
        classId: numericClassId,
        parentName: parentName.trim(),
        parentSurname: parentSurname.trim(),
        parentPhone: parentPhone.trim(),
        address: address ? address.trim() : "Non renseignée",
        relation: relation || "Père",
        email: email ? email.trim() : null,
        childrenData: children,
        schoolId: schoolId || "default_school",
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      requestId: newRequest.id,
      message: "Votre demande d'inscription a été transmise avec succès à la direction de l'école.",
    });
  } catch (error: any) {
    console.error("POST /api/join/submit error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la soumission de l'inscription." }, { status: 500 });
  }
}
