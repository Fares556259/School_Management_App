import { actionReviewFingerprint } from './actionReview';

export interface ActionCardField {
  label: string;
  value: string;
  icon?: string;
}

export interface ActionCardData {
  toolCallId: string;
  toolName: string;
  reviewFingerprint: string;
  actionTitle: string;
  actionType: "expense" | "income" | "payment" | "student" | "class" | "attendance" | "announcement" | "generic";
  confirmText: string;
  fields: ActionCardField[];
  status: "PENDING" | "EXECUTING" | "EXECUTED" | "REJECTED" | "FAILED" | "EXPIRED";
  reference?: string;
  resultMessage?: string;
  completedAt?: string;
  arguments?: Record<string, any>;
}

export function buildActionCardMetadata(toolCallId: string, toolName: string, args: Record<string, any>, confirmText: string): ActionCardData {
  return { ...buildActionCardContent(toolCallId, toolName, args, confirmText), reviewFingerprint: actionReviewFingerprint(toolCallId, toolName, args) };
}

function buildActionCardContent(
  toolCallId: string,
  toolName: string,
  args: Record<string, any>,
  confirmText: string
): Omit<ActionCardData, 'reviewFingerprint'> {
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (toolName === "add_expense") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Ajouter une dépense",
      actionType: "expense",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Montant", value: `${args.amount || 0} DT` },
        { label: "Catégorie", value: args.category || "Général" },
        { label: "Description", value: args.title || args.description || "Facture / Dépense" },
        { label: "Date", value: args.date || today },
      ],
    };
  }

  if (toolName === "add_income") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Encaisser une recette",
      actionType: "income",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Montant", value: `${args.amount || 0} DT` },
        { label: "Description", value: args.title || args.description || "Recette du jour (Entrée caisse)" },
        { label: "Catégorie", value: args.category || "Frais scolarité" },
        { label: "Date", value: args.date || today },
      ],
    };
  }

  if (toolName === "record_payment" || toolName === "record_parent_payment") {
    const studentOrParent = args.studentNameOrId || args.parentNameOrId || "Élève";
    return {
      toolCallId,
      toolName,
      actionTitle: "Encaisser un paiement",
      actionType: "payment",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Montant", value: `${args.amount || 0} DT` },
        { label: "Bénéficiaire", value: studentOrParent },
        { label: "Période", value: args.feePeriod || new Date(args.year || new Date().getFullYear(), (args.month || new Date().getMonth() + 1) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) },
        { label: "Mode de règlement", value: args.paymentMethod || "Espèces" },
      ],
    };
  }

  if (toolName === "create_student") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Inscrire un nouvel élève",
      actionType: "student",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Nom & Prénom", value: `${args.name || ""} ${args.surname || ""}`.trim() || "Nouvel élève" },
        { label: "Classe", value: args.className || "Non assignée" },
        { label: "Contact Parent", value: args.parentPhone || args.parentName || "Non renseigné" },
        { label: "Frais mensuels", value: args.customTuition ? `${args.customTuition} DT` : "Standard" },
      ],
    };
  }

  if (toolName === "create_class") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Créer une nouvelle classe",
      actionType: "class",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Nom de la classe", value: args.name || "Nouvelle classe" },
        { label: "Niveau", value: args.levelNumber ? `Niveau ${args.levelNumber}` : "Standard" },
        { label: "Capacité maximale", value: args.capacity ? `${args.capacity} élèves` : "30 élèves" },
      ],
    };
  }

  if (toolName === "mark_class_attendance") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Valider l'appel de classe",
      actionType: "attendance",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Classe", value: args.className || "Classe" },
        { label: "Date de l'appel", value: args.date || today },
        { label: "Séance", value: args.sessionName || "Toutes les séances" },
        { label: "Statut par défaut", value: args.defaultStatus || "PRESENT" },
        { label: "Retards", value: (args.lateStudents || []).map((student: any) => `${student.name}${student.note ? ` (${student.note})` : ""}`).join(", ") || "Aucun" },
        { label: "Absents signalés", value: (args.absentStudents || args.absentNames || []).join(", ") || "Aucun" },
      ],
    };
  }

  if (toolName === "post_announcement" || toolName === "send_push_notification") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Diffuser une annonce aux parents",
      actionType: "announcement",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Destinataires", value: args.studentName || args.targetName || args.className || ({ me: "Mon appareil", teachers: "Tous les enseignants", parents: "Tous les parents", unpaid: "Familles avec impayés", all: "Toute l’école" } as Record<string, string>)[args.target] || (toolName === "post_announcement" ? "Toute l’école" : args.target || "À préciser") },
        { label: "Titre de l'annonce", value: args.title || "Annonce" },
        { label: "Contenu", value: args.message || args.content || "" },
      ],
    };
  }

  return {
    toolCallId,
    toolName,
    actionTitle: `Confirmer l'action : ${toolName}`,
    actionType: "generic",
    confirmText,
    status: "PENDING",
    arguments: args,
    fields: Object.entries(args)
      .filter(([k]) => !k.startsWith("_") && k !== "schoolId" && k !== "adminId")
      .map(([k, v]) => ({ label: k, value: typeof v === "object" ? JSON.stringify(v) : String(v) })),
  };
}

