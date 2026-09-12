import { FunctionDeclaration, SchemaType } from "@google/generative-ai";
import {
  getStudentsTool,
  getAttendanceTool,
  getPaymentsTool,
  getFinancialSummaryTool,
  getTeachersTool,
  ToolContext,
} from "./readTools";
import {
  recordPaymentTool,
  addExpenseTool,
  postAnnouncementTool,
  WriteToolResult,
} from "./writeTools";

export interface ToolDefinition {
  name: string;
  description: string;
  declaration: FunctionDeclaration;
  requiresConfirmation: boolean;
  execute: (args: any, context: ToolContext) => Promise<any>;
  formatConfirmationMessage?: (args: any, context: ToolContext) => string;
}

export const TOOLS: Record<string, ToolDefinition> = {
  get_students: {
    name: "get_students",
    description: "Rechercher ou lister les élèves de l'école par nom, téléphone ou classe.",
    requiresConfirmation: false,
    declaration: {
      name: "get_students",
      description: "Rechercher ou lister les élèves de l'école par nom, prénom, classe ou numéro de téléphone.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: {
            type: SchemaType.STRING,
            description: "Nom, prénom ou téléphone de l'élève recherché.",
          },
          className: {
            type: SchemaType.STRING,
            description: "Nom de la classe (ex: '8ème B', '1A').",
          },
          limit: {
            type: SchemaType.NUMBER,
            description: "Nombre maximum d'élèves à retourner.",
          },
        },
      },
    },
    execute: getStudentsTool,
  },

  get_attendance: {
    name: "get_attendance",
    description: "Consulter les présences et absences des élèves pour aujourd'hui ou une date donnée.",
    requiresConfirmation: false,
    declaration: {
      name: "get_attendance",
      description: "Consulter la liste des élèves absents ou en retard pour aujourd'hui ou une date spécifique.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: {
            type: SchemaType.STRING,
            description: "Date au format AAAA-MM-JJ (ex: '2026-09-12'). Si omise, prend aujourd'hui.",
          },
          className: {
            type: SchemaType.STRING,
            description: "Filtrer par nom de classe (ex: '8ème B').",
          },
          status: {
            type: SchemaType.STRING,
            description: "Statut à filtrer: 'ABSENT', 'LATE', ou 'PRESENT'.",
          },
        },
      },
    },
    execute: getAttendanceTool,
  },

  get_payments: {
    name: "get_payments",
    description: "Consulter les paiements de scolarité, impayés, ou paiements en retard.",
    requiresConfirmation: false,
    declaration: {
      name: "get_payments",
      description: "Vérifier le statut des paiements des frais de scolarité pour un mois/année, ou les impayés.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          month: {
            type: SchemaType.NUMBER,
            description: "Mois numérique (1 à 12). Par défaut le mois en cours.",
          },
          year: {
            type: SchemaType.NUMBER,
            description: "Année (ex: 2026).",
          },
          status: {
            type: SchemaType.STRING,
            description: "Filtrer par statut: 'PENDING' (en attente), 'PAID' (payé), 'PARTIAL' (partiel).",
          },
          studentName: {
            type: SchemaType.STRING,
            description: "Nom de l'élève à vérifier.",
          },
        },
      },
    },
    execute: getPaymentsTool,
  },

  get_financial_summary: {
    name: "get_financial_summary",
    description: "Obtenir le bilan financier du mois: revenus, dépenses, bénéfice net et impayés.",
    requiresConfirmation: false,
    declaration: {
      name: "get_financial_summary",
      description: "Obtenir les chiffres clés financiers de l'école (revenus encaissés, dépenses, marge, impayés).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          month: {
            type: SchemaType.NUMBER,
            description: "Mois numérique (1 à 12).",
          },
          year: {
            type: SchemaType.NUMBER,
            description: "Année (ex: 2026).",
          },
        },
      },
    },
    execute: getFinancialSummaryTool,
  },

  get_teachers: {
    name: "get_teachers",
    description: "Consulter la liste des enseignants, leurs matières et classes assignées.",
    requiresConfirmation: false,
    declaration: {
      name: "get_teachers",
      description: "Lister les enseignants de l'école ou chercher qui enseigne une matière.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: {
            type: SchemaType.STRING,
            description: "Nom ou numéro de l'enseignant.",
          },
          subjectName: {
            type: SchemaType.STRING,
            description: "Matière enseignée (ex: 'Mathématiques', 'Français').",
          },
        },
      },
    },
    execute: getTeachersTool,
  },

  record_payment: {
    name: "record_payment",
    description: "Enregistrer un paiement de frais de scolarité reçu d'un parent ou d'un élève.",
    requiresConfirmation: true,
    declaration: {
      name: "record_payment",
      description: "Enregistrer un paiement de scolarité (montant en Dinars Tunisiens DT, nom de l'élève, mois).",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "amount"],
        properties: {
          studentNameOrId: {
            type: SchemaType.STRING,
            description: "Nom complet de l'élève ou son identifiant.",
          },
          amount: {
            type: SchemaType.NUMBER,
            description: "Montant reçu en Dinars Tunisiens (DT).",
          },
          month: {
            type: SchemaType.NUMBER,
            description: "Numéro du mois concerné (1 à 12).",
          },
          year: {
            type: SchemaType.NUMBER,
            description: "Année concernée (ex: 2026).",
          },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const monthStr = args.month ? ` pour le mois ${args.month}` : "";
      return `❓ **Confirmation requise :**\nSouhaitez-vous enregistrer le paiement de **${args.amount} DT** pour l'élève **${args.studentNameOrId}**${monthStr} ?`;
    },
    execute: recordPaymentTool,
  },

  add_expense: {
    name: "add_expense",
    description: "Enregistrer une dépense ou facture payée par l'école.",
    requiresConfirmation: true,
    declaration: {
      name: "add_expense",
      description: "Enregistrer une nouvelle dépense (fournitures, maintenance, loyer, etc.).",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "amount"],
        properties: {
          title: {
            type: SchemaType.STRING,
            description: "Description de la dépense (ex: 'Facture STEG', 'Papeterie').",
          },
          amount: {
            type: SchemaType.NUMBER,
            description: "Montant en Dinars Tunisiens (DT).",
          },
          category: {
            type: SchemaType.STRING,
            description: "Catégorie (ex: 'Factures', 'Fournitures', 'Maintenance', 'Salaires').",
          },
          date: {
            type: SchemaType.STRING,
            description: "Date au format AAAA-MM-JJ si différente d'aujourd'hui.",
          },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ **Confirmation requise :**\nSouhaitez-vous enregistrer la dépense **"${args.title}"** d'un montant de **${args.amount} DT** (Catégorie : ${
        args.category || "Général"
      }) ?`;
    },
    execute: addExpenseTool,
  },

  post_announcement: {
    name: "post_announcement",
    description: "Publier une annonce officielle pour l'école ou une classe spécifique.",
    requiresConfirmation: true,
    declaration: {
      name: "post_announcement",
      description: "Publier une annonce / avis visible par les parents et enseignants.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "message"],
        properties: {
          title: {
            type: SchemaType.STRING,
            description: "Titre de l'annonce.",
          },
          message: {
            type: SchemaType.STRING,
            description: "Contenu détaillé du message.",
          },
          className: {
            type: SchemaType.STRING,
            description: "Nom de la classe si l'annonce est réservée à une classe spécifique.",
          },
          important: {
            type: SchemaType.BOOLEAN,
            description: "Indiquer si l'annonce est urgente / importante.",
          },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const target = args.className ? `la classe **${args.className}**` : "**toute l'école**";
      return `❓ **Confirmation requise :**\nSouhaitez-vous publier l'annonce suivante pour ${target} ?\n\n📌 **${args.title}**\n${args.message}`;
    },
    execute: postAnnouncementTool,
  },
};

/**
 * Returns array of Gemini Function Declarations for model initialization
 */
export function getGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return Object.values(TOOLS).map((t) => t.declaration);
}
