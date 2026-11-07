import { actionReviewFingerprint } from './actionReview';
import type { ExpenseReviewDisplay } from './expenseReversal';

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
  paymentReview?: import("./paymentActions").PaymentReview;
}

export function buildActionCardMetadata(toolCallId: string, toolName: string, args: Record<string, any>, confirmText: string, display?: ExpenseReviewDisplay): ActionCardData {
  const card = buildActionCardContent(toolCallId, toolName, args, confirmText);
  if (display?.payment) {
    card.paymentReview = display.payment;
    card.actionType = 'payment';
    card.actionTitle = toolName === 'set_teacher_overtime' ? 'Ajouter au salaire' : toolName === 'pay_teacher_salary' ? 'Verser un salaire' : 'Encaisser un paiement';
    card.fields = [{ label: 'Bénéficiaire', value: display.payment.beneficiary }, { label: 'Montant', value: toolName === 'set_teacher_overtime' && args.mode === 'hourly' ? `${Math.round(args.hours * args.rate * 1000) / 1000} TND` : args.amount > 0 ? `${args.amount} TND` : 'À préciser' }];
    if (toolName === 'record_payment') card.fields.push(...(args.items || []).map((item: any) => ({ label: display.payment!.choices?.find(c => c.kind === item.kind && c.period === item.period)?.label || item.kind, value: `${item.period} · ${item.amount} TND` })));
    if (toolName !== 'record_payment' && args.month && args.year) card.fields.push({ label: 'Période', value: `${args.year}-${String(args.month).padStart(2, '0')}` });
    if (display.payment.type === 'student') card.fields.push({ label: 'Mode de règlement', value: args.paymentMethod }, { label: 'Date', value: args.paidOn });
    if (display.payment.type !== 'student') {
      const p = display.payment;
      card.fields.push({ label: 'Salaire de base', value: `${p.baseSalary} TND` });
      if (p.deduction) card.fields.push({ label: 'Retenue d’absence', value: `− ${p.deduction} TND` });
      if (p.overtimeLines?.length) card.fields.push(...p.overtimeLines.map(line => ({ label: 'Heures supplémentaires', value: `${line.hours} h${line.rate !== null && !line.legacy ? ` × ${line.rate} TND/h` : ' · Historique (taux indisponible)'} · + ${line.amount} TND` })));
      else if (p.overtimeHours) card.fields.push({ label: 'Heures supplémentaires', value: `${p.overtimeHours} h · + ${p.hourlyAmount} TND` });
      if (p.fixedAmount) card.fields.push({ label: 'Complément forfaitaire', value: `+ ${p.fixedAmount} TND` });
      if (p.amountPaid) card.fields.push({ label: 'Déjà versé', value: `${p.amountPaid} TND` });
      card.fields.push({ label: 'Reste à payer', value: `${p.remaining} TND` });
    }
    if (toolName === 'set_teacher_overtime') card.fields.push({ label: 'Ajout', value: args.mode === 'fixed' ? `Forfait · ${args.amount} TND` : `${args.hours} h × ${args.rate} TND/h` });
  }
  if (display?.beneficiary) card.fields = card.fields.map(field => field.label === 'Bénéficiaire' ? { ...field, value: display.beneficiary! } : field);
  if (toolName === 'void_expense' && display?.expense) card.fields = [
    { label: 'Description', value: display.expense.title }, { label: 'Montant', value: `${display.expense.amount} DT` },
    { label: 'Catégorie', value: display.expense.category }, { label: 'Date', value: display.expense.date.slice(0, 10) },
  ];
  return { ...card, reviewFingerprint: actionReviewFingerprint(toolCallId, toolName, args) };
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

  if (toolName === 'void_expense') return {
    toolCallId, toolName, actionTitle: 'Annuler une dépense', actionType: 'generic', confirmText, status: 'PENDING', arguments: args,
    fields: [{ label: 'Description', value: args.query || 'Dépense sélectionnée' }, { label: 'Montant', value: args.amount > 0 ? `${args.amount} DT` : 'À vérifier' }],
  };

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
        { label: "Montant", value: typeof args.amount === 'number' && args.amount > 0 ? `${args.amount} DT` : 'À préciser' },
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

