import prisma from "@/lib/prisma";
import { ToolContext } from "./readTools";

export interface TeachHniaArgs {
  instruction: string;
  category?: string;
}

export interface GetTeachingsArgs {
  category?: string;
  query?: string;
}

export interface ForgetTeachingArgs {
  query?: string;
  teachingId?: string;
}

/**
 * Tool: teach_hnia
 * Saves a custom instruction, school rule, bus route/contact, price, policy, or correction.
 */
export async function teachHniaTool(args: TeachHniaArgs, context: ToolContext) {
  const instruction = (args.instruction || "").trim();
  if (!instruction) {
    return {
      error: true,
      message: "Veuillez préciser la règle ou la consigne à mémoriser.",
    };
  }

  const rawCat = (args.category || "GENERAL").toUpperCase().trim();
  const validCategories = [
    "GENERAL",
    "FINANCE",
    "TRANSPORT",
    "RULES",
    "TIMETABLE",
    "STAFF",
    "PEDAGOGY",
  ];
  const category = validCategories.includes(rawCat) ? rawCat : "GENERAL";

  const record = await prisma.aIKnowledge.create({
    data: {
      schoolId: context.schoolId,
      adminId: context.adminId || null,
      category,
      instruction,
      isActive: true,
    },
  });

  const categoryEmojis: Record<string, string> = {
    GENERAL: "📌 Général",
    FINANCE: "💰 Finance & Tarifs",
    TRANSPORT: "🚌 Transport & Bus",
    RULES: "📜 Règlements & Sécurité",
    TIMETABLE: "⏰ Emploi du temps",
    STAFF: "👥 Personnel & Enseignants",
    PEDAGOGY: "📚 Pédagogie & Examens",
  };

  const categoryBadge = categoryEmojis[category] || `📂 ${category}`;
  const todayStr = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const formattedText = `🧠 <b>Nouvelle Connaissance Mémorisée !</b>
━━━━━━━━━━━━━━━━━━━━━━
📝 <b>Consigne / Règle :</b>
<i>« ${instruction} »</i>

📂 <b>Domaine :</b> <code>${categoryBadge}</code>
👤 <b>Auteur :</b> ${context.adminName || "Administrateur"}
📅 <b>Date :</b> <code>${todayStr}</code>

<blockquote>💡 <b>Hnia :</b> C'est bien noté ! J'ai enregistré cette directive et je l'appliquerai automatiquement pour toutes les opérations de l'école.</blockquote>`;

  return {
    success: true,
    id: record.id,
    instruction,
    category,
    formattedText,
    message: formattedText,
  };
}

/**
 * Tool: get_hnia_teachings
 * Lists all active custom knowledge, rules, and notes taught to Hnia by the admin.
 */
export async function getHniaTeachingsTool(args: GetTeachingsArgs, context: ToolContext) {
  const where: any = {
    schoolId: context.schoolId,
    isActive: true,
  };

  if (args.category) {
    where.category = args.category.toUpperCase().trim();
  }

  if (args.query && args.query.trim()) {
    where.instruction = {
      contains: args.query.trim(),
      mode: "insensitive",
    };
  }

  const items = await prisma.aIKnowledge.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (items.length === 0) {
    const emptyText = `🧠 <b>Connaissances Personnalisées</b>
━━━━━━━━━━━━━━━━━━━━━━
Aucune règle personnalisée n'est encore enregistrée pour votre école.

<blockquote>💡 <b>Hnia :</b> Pour m'apprendre des règles ou faits sur votre école, dites-moi simplement :
• <i>« Hnia retiens que le bus 2 est conduit par Am Hedi au 98123456 »</i>
• <i>« Hnia la cantine coûte 130 DT par mois »</i>
• <i>« Hnia note cette règle : pas de sorties non autorisées le vendredi »</i></blockquote>`;

    return {
      success: true,
      count: 0,
      teachings: [],
      formattedText: emptyText,
      message: emptyText,
    };
  }

  const categoryEmojis: Record<string, string> = {
    GENERAL: "📌 Général",
    FINANCE: "💰 Finance",
    TRANSPORT: "🚌 Transport",
    RULES: "📜 Règle",
    TIMETABLE: "⏰ Horaires",
    STAFF: "👥 Personnel",
    PEDAGOGY: "📚 Pédagogie",
  };

  const lines = items.map((item, idx) => {
    const badge = categoryEmojis[item.category] || item.category;
    const dateStr = item.createdAt.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
    return `<b>${idx + 1}. [${badge}]</b> <i>« ${item.instruction} »</i> (<code>${dateStr}</code>)`;
  });

  const formattedText = `🧠 <b>Connaissances & Règles de l'École (${items.length})</b>
━━━━━━━━━━━━━━━━━━━━━━
Voici les directives spécifiques que vous m'avez apprises :

${lines.join("\n\n")}

<blockquote>💡 <b>Hnia :</b> J'applique ces directives en continu. Pour en supprimer une, dites simplement : <i>« Hnia oublie la règle sur [mot-clé] »</i>.</blockquote>`;

  return {
    success: true,
    count: items.length,
    teachings: items.map((t) => ({
      id: t.id,
      category: t.category,
      instruction: t.instruction,
      createdAt: t.createdAt,
    })),
    formattedText,
    message: formattedText,
  };
}

/**
 * Tool: forget_hnia_teaching
 * Deactivates or removes a custom instruction by query keywords or ID.
 */
export async function forgetHniaTeachingTool(args: ForgetTeachingArgs, context: ToolContext) {
  const query = (args.query || "").trim();
  const teachingId = args.teachingId?.trim();

  if (!query && !teachingId) {
    return {
      error: true,
      message: "Veuillez préciser quelle consigne ou règle vous souhaitez que j'oublie.",
    };
  }

  const where: any = {
    schoolId: context.schoolId,
    isActive: true,
  };

  if (teachingId) {
    where.id = teachingId;
  } else if (query.toLowerCase() === "tous" || query.toLowerCase() === "tout") {
    // Clear all for school
  } else {
    where.instruction = {
      contains: query,
      mode: "insensitive",
    };
  }

  const found = await prisma.aIKnowledge.findMany({ where });

  if (found.length === 0) {
    const notFoundText = `🔍 <b>Aucune consigne correspondante trouvée</b>
━━━━━━━━━━━━━━━━━━━━━━
Je n'ai trouvé aucune consigne active correspondant à <i>« ${query} »</i>.

<blockquote>💡 <b>Hnia :</b> Tapez <i>« Hnia qu'est-ce que tu as appris ? »</i> pour voir la liste complète de mes notes actuelles.</blockquote>`;
    return {
      success: false,
      notFound: true,
      formattedText: notFoundText,
      message: notFoundText,
    };
  }

  // Deactivate them
  await prisma.aIKnowledge.updateMany({
    where: {
      id: { in: found.map((f) => f.id) },
    },
    data: {
      isActive: false,
    },
  });

  const removedList = found.map((f) => `• <s>${f.instruction}</s>`).join("\n");

  const formattedText = `🗑️ <b>Connaissance(s) Oubliée(s) (${found.length})</b>
━━━━━━━━━━━━━━━━━━━━━━
J'ai effacé la/les consigne(s) suivante(s) de ma mémoire :

${removedList}

<blockquote>💡 <b>Hnia :</b> Cette consigne ne sera plus prise en compte dans les futures interactions de l'école.</blockquote>`;

  return {
    success: true,
    count: found.length,
    formattedText,
    message: formattedText,
  };
}
