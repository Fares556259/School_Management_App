import { FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";

// Suite 1: Academic
import {
  getStudentsTool,
  getAttendanceTool,
  getPaymentsTool,
  getFinancialSummaryTool,
  getTeachersTool,
  getMorningBriefingTool,
} from "./readTools";
import prisma from "@/lib/prisma";
import { MONTHS, formatMonthFrench } from "@/lib/dateUtils";
import {
  recordPaymentTool,
  recordParentPaymentTool,
  addExpenseTool,
  calculateStudentPaymentAllocation,
  calculateParentPaymentDistribution,
} from "./writeTools";
import { resolveStudentByName, resolveParentByName } from "./entityResolvers";
import {
  getAnnouncementsTool,
  postAnnouncementTool,
  deleteAnnouncementTool,
} from "./announcementTools";
import {
  getStudentProfileTool,
  getParentsTool,
  getClassesTool,
  createStudentTool,
  createParentTool,
  createClassTool,
  assignStudentToClassTool,
  updateParentPhoneTool,
  updateStudentTool,
} from "./academicTools";

import {
  getStaffTool,
  createTeacherTool,
  createStaffTool,
  payTeacherSalaryTool,
  payStaffSalaryTool,
  getSalaryDetailsTool,
  trackTeacherAbsentHoursTool,
} from "./teacherStaffTools";

// Suite 3: Attendance
import {
  getStudentAttendanceHistoryTool,
  markAttendanceTool,
  markClassAttendanceTool,
  justifyAttendanceTool,
} from "./attendanceTools";

// Suite 4: Grades & Exams
import {
  getStudentGradesTool,
  getClassGradeSheetTool,
  getExamsTool,
  recordGradeTool,
  scheduleExamTool,
} from "./gradeExamTools";

// Suite 5: Finance & Reminders
import {
  getFinancialAnomaliesTool,
  sendPaymentRemindersTool,
  sendParentMessageTool,
  getPartialPaymentsTool,
  recoverPartialPaymentTool,
  scheduleRecoveryDateTool,
  getIncomesTool,
  addIncomeTool,
  getExpensesTool,
  getDailyCaisseTool,
  voidExpenseTool,
  cancelPaymentTool,
} from "./financeTools";

// Suite 6: Timetable & Substitution
import {
  getClassTimetableTool,
  findAvailableTeachersTool,
  addTimetableSlotTool,
} from "./timetableTools";

// Suite 7: Tasks, Homework & Course Resources
import {
  getAssignmentsTool,
  createAssignmentTool,
  getAssignmentDetailsTool,
  createResourceTool,
  getResourcesTool,
} from "./taskTools";

// Suite 8: School Knowledge & Admin Teaching
import {
  teachHniaTool,
  getHniaTeachingsTool,
  forgetHniaTeachingTool,
} from "./knowledgeTools";

// Suite 9: Personal Reminders & Alarms
import {
  scheduleReminderTool,
  getRemindersTool,
  cancelReminderTool,
} from "./reminderTools";

// Suite 10: Official PDF Documents & Receipts
import {
  getPaymentReceiptTool,
  getSalaryPayslipTool,
} from "./documentTools";


export interface ToolDefinition {
  name: string;
  description: string;
  declaration: FunctionDeclaration;
  requiresConfirmation: boolean;
  execute: (args: any, context: ToolContext) => Promise<any>;
  formatConfirmationMessage?: (args: any, context: ToolContext) => string | Promise<string>;
}

export const TOOLS: Record<string, ToolDefinition> = {
  // ── ACADEMIC SUITE ────────────────────────────────────────────────────────
  get_students: {
    name: "get_students",
    description: "Rechercher ou lister les élèves par nom, prénom, classe ou téléphone.",
    requiresConfirmation: false,
    declaration: {
      name: "get_students",
      description: "Rechercher ou lister les élèves de l'école par nom, prénom, classe ou téléphone.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { type: SchemaType.STRING, description: "Nom, prénom ou téléphone." },
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '8ème B')." },
          limit: { type: SchemaType.NUMBER, description: "Nombre maximum d'élèves." },
        },
      },
    },
    execute: getStudentsTool,
  },

  get_student_profile: {
    name: "get_student_profile",
    description: "Consulter la fiche complète 360° d'un élève (coordonnées parents, scolarité, absences, dernières notes). Supporte le filtrage par classe (ex: '3A') ou par nom/téléphone de parent pour désambiguïser immédiatement les élèves homonymes.",
    requiresConfirmation: false,
    declaration: {
      name: "get_student_profile",
      description: "Obtenir la fiche complète 360° d'un élève avec scolarité, coordonnées parentales, présences et notes. Peut être filtré par classe ou parent pour lever toute ambiguïté sur des homonymes.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève." },
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '3A', '1A') pour désambiguïser les homonymes." },
          parentNameOrId: { type: SchemaType.STRING, description: "Nom ou téléphone du parent pour désambiguïser les homonymes." },
        },
      },
    },
    execute: getStudentProfileTool,
  },

  get_parents: {
    name: "get_parents",
    description: "Rechercher des parents d'élèves par nom, prénom, téléphone ou nom d'un enfant. Fournit le bilan financier familial complet pour le mois (frais totaux, montant versé, reste à payer) et le détail nominatif précis des enfants impayés (unpaidChildren) et des enfants soldés (paidChildren).",
    requiresConfirmation: false,
    declaration: {
      name: "get_parents",
      description: "Rechercher des parents d'élèves par nom, prénom, téléphone ou contact, et consulter la situation financière de chaque enfant.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { type: SchemaType.STRING, description: "Nom, prénom, téléphone ou contact du parent (ex: 'Moune Saoud', '6458558')." },
          month: { type: SchemaType.NUMBER, description: "Numéro du mois (1 à 12, optionnel. Par défaut : mois actuel en cours)." },
          year: { type: SchemaType.NUMBER, description: "Année (optionnel, ex: 2026. Par défaut : année actuelle)." },
        },
      },
    },
    execute: getParentsTool,
  },

  get_classes: {
    name: "get_classes",
    description: "Lister toutes les classes de l'école avec effectifs, capacité et professeur principal.",
    requiresConfirmation: false,
    declaration: {
      name: "get_classes",
      description: "Lister toutes les classes de l'école avec leur effectif et professeur principal.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          levelNumber: { type: SchemaType.NUMBER, description: "Filtrer par niveau (ex: 8)." },
        },
      },
    },
    execute: getClassesTool,
  },

  create_student: {
    name: "create_student",
    description: "Inscrire un nouvel élève dans une classe avec téléphone des parents et frais de scolarité optionnels.",
    requiresConfirmation: true,
    declaration: {
      name: "create_student",
      description: "Inscrire un nouvel élève dans une classe.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["name", "surname", "className"],
        properties: {
          name: { type: SchemaType.STRING, description: "Prénom de l'élève." },
          surname: { type: SchemaType.STRING, description: "Nom de famille de l'élève." },
          className: { type: SchemaType.STRING, description: "Classe d'affectation (ex: '8ème B')." },
          parentPhone: { type: SchemaType.STRING, description: "Numéro de téléphone du parent." },
          parentName: { type: SchemaType.STRING, description: "Nom du parent." },
          customTuition: { type: SchemaType.NUMBER, description: "Frais de scolarité personnalisés (si dérogation)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Confirmation d'Inscription</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous inscrire <b>${args.name} ${args.surname}</b> en classe <code>${args.className}</code>${
        args.parentPhone ? ` (Parent : <code>${args.parentPhone}</code>)` : ""
      } ?`;
    },
    execute: createStudentTool,
  },

  create_parent: {
    name: "create_parent",
    description: "Ajouter un nouveau parent d'élève avec son prénom, nom, téléphone et le relier optionnellement à un élève.",
    requiresConfirmation: true,
    declaration: {
      name: "create_parent",
      description: "Ajouter un parent d'élève dans l'école et l'associer optionnellement à son enfant.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["name", "surname", "phone"],
        properties: {
          name: { type: SchemaType.STRING, description: "Prénom du parent." },
          surname: { type: SchemaType.STRING, description: "Nom de famille du parent." },
          phone: { type: SchemaType.STRING, description: "Numéro de téléphone du parent (ex: '98123456')." },
          address: { type: SchemaType.STRING, description: "Adresse ou ville du parent (optionnel)." },
          studentNameOrId: { type: SchemaType.STRING, description: "Nom de l'enfant à rattacher (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const childStr = args.studentNameOrId ? ` (Enfant : <b>${args.studentNameOrId}</b>)` : "";
      return `❓ <b>Nouveau Parent</b>\n━━━━━━━━━━━━━━━━━━━━━━\nEnregistrer le parent <b>${args.name} ${args.surname}</b> (📞 <code>${args.phone}</code>)${childStr} ?`;
    },
    execute: createParentTool,
  },

  create_class: {
    name: "create_class",
    description: "Créer une nouvelle classe dans l'école (ex: '8ème B') avec capacité.",
    requiresConfirmation: true,
    declaration: {
      name: "create_class",
      description: "Créer une nouvelle classe dans l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["name"],
        properties: {
          name: { type: SchemaType.STRING, description: "Nom de la classe (ex: '8ème B', '1ère A')." },
          capacity: { type: SchemaType.NUMBER, description: "Capacité maximale d'élèves (défaut : 25)." },
          levelNumber: { type: SchemaType.NUMBER, description: "Numéro de niveau académique (optionnel, déduit sinon)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Création de Classe</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous créer la classe <code>${args.name}</code> (Capacité : <code>${args.capacity || 25} élèves</code>) ?`;
    },
    execute: createClassTool,
  },

  assign_student_to_class: {
    name: "assign_student_to_class",
    description: "Déplacer ou affecter un élève dans une classe spécifique.",
    requiresConfirmation: true,
    declaration: {
      name: "assign_student_to_class",
      description: "Affecter ou déplacer un élève vers une autre classe.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "className"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'élève." },
          className: { type: SchemaType.STRING, description: "Nouvelle classe de destination." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Affectation de Classe</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous affecter <b>${args.studentNameOrId}</b> à la classe <code>${args.className}</code> ?`;
    },
    execute: assignStudentToClassTool,
  },

  // ── TEACHERS & STAFF SUITE ────────────────────────────────────────────────
  get_teachers: {
    name: "get_teachers",
    description: "Lister les enseignants, leurs matières et leurs classes assignées.",
    requiresConfirmation: false,
    declaration: {
      name: "get_teachers",
      description: "Lister les enseignants de l'école ou chercher qui enseigne une matière.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { type: SchemaType.STRING, description: "Nom ou numéro de l'enseignant." },
          subjectName: { type: SchemaType.STRING, description: "Matière enseignée." },
        },
      },
    },
    execute: getTeachersTool,
  },

  get_staff: {
    name: "get_staff",
    description: "Lister le personnel non-enseignant (administration, maintenance, chauffeurs).",
    requiresConfirmation: false,
    declaration: {
      name: "get_staff",
      description: "Lister le personnel administratif et opérationnel.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { type: SchemaType.STRING, description: "Nom ou téléphone." },
        },
      },
    },
    execute: getStaffTool,
  },

  create_teacher: {
    name: "create_teacher",
    description: "Recruter un nouvel enseignant avec téléphone, matières enseignées et taux horaire.",
    requiresConfirmation: true,
    declaration: {
      name: "create_teacher",
      description: "Ajouter un nouvel enseignant.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["name", "surname", "phone"],
        properties: {
          name: { type: SchemaType.STRING, description: "Prénom." },
          surname: { type: SchemaType.STRING, description: "Nom de famille." },
          phone: { type: SchemaType.STRING, description: "Numéro de téléphone." },
          subjectNames: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Liste des matières enseignées.",
          },
          hourlyRate: { type: SchemaType.NUMBER, description: "Taux horaire en DT (défaut : 25 DT)." },
          hoursPerMonth: { type: SchemaType.NUMBER, description: "Volume horaire mensuel prévu." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Nouveau Professeur</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous enregistrer <b>${args.name} ${args.surname}</b> (📞 <code>${args.phone}</code>) ?`;
    },
    execute: createTeacherTool,
  },

  create_staff: {
    name: "create_staff",
    description: "Ajouter un membre du personnel (chauffeur, gardien, agent administratif).",
    requiresConfirmation: true,
    declaration: {
      name: "create_staff",
      description: "Ajouter un membre du personnel non enseignant.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["name", "surname", "phone"],
        properties: {
          name: { type: SchemaType.STRING, description: "Prénom." },
          surname: { type: SchemaType.STRING, description: "Nom." },
          phone: { type: SchemaType.STRING, description: "Numéro de téléphone." },
          salary: { type: SchemaType.NUMBER, description: "Salaire mensuel en DT." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Nouveau Membre du Personnel</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous ajouter <b>${args.name} ${args.surname}</b>${
        args.salary ? ` (Salaire : <code>${args.salary} DT</code>)` : ""
      } ?`;
    },
    execute: createStaffTool,
  },

  get_salary_details: {
    name: "get_salary_details",
    description: "Consulter la fiche financière détaillée d'un enseignant ou membre du personnel : salaire de base, heures d'absence, déductions appliquées, avances perçues et solde net restant dû pour un mois ou l'année.",
    requiresConfirmation: false,
    declaration: {
      name: "get_salary_details",
      description: "Obtenir la fiche financière d'un enseignant ou personnel : salaire de base, retenues d'absences, avances perçues et solde net restant dû.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["nameOrId"],
        properties: {
          nameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'enseignant ou membre du personnel (ex: 'Asma', 'Si Moncef', 'Mme Trabelsi')." },
          month: { type: SchemaType.NUMBER, description: "Mois cible (1 à 12, ex: 9 pour Septembre). Par défaut : mois actuel." },
          year: { type: SchemaType.NUMBER, description: "Année cible (ex: 2026). Par défaut : année actuelle." },
        },
      },
    },
    execute: getSalaryDetailsTool,
  },

  track_teacher_absent_hours: {
    name: "track_teacher_absent_hours",
    description: "Enregistrer des heures d'absence manquées pour un enseignant et calculer la retenue financière sur salaire correspondante.",
    requiresConfirmation: true,
    declaration: {
      name: "track_teacher_absent_hours",
      description: "Noter des heures manquées d'absence pour un enseignant et ajuster sa déduction sur salaire.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["teacherNameOrId", "missedHours"],
        properties: {
          teacherNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'enseignant (ex: 'Asma', 'Si Moncef')." },
          missedHours: { type: SchemaType.NUMBER, description: "Nombre total d'heures d'absence à enregistrer pour ce mois (ex: 2)." },
          month: { type: SchemaType.NUMBER, description: "Mois concerné (1 à 12). Par défaut : mois actuel." },
          year: { type: SchemaType.NUMBER, description: "Année (ex: 2026)." },
          deductionStatus: { type: SchemaType.STRING, description: "Statut de la retenue : 'APPLIED' (déduire du salaire) ou 'PENDING' (en attente d'arbitrage). Par défaut : 'APPLIED'." },
          notes: { type: SchemaType.STRING, description: "Remarque ou motif de l'absence." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const FRENCH_MONTHS = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
      ];
      const monthLabel = args.month
        ? `${FRENCH_MONTHS[args.month - 1] || "Mois " + args.month}${args.year ? " " + args.year : ""}`
        : "ce mois-ci";
      return `❓ <b>Enregistrement Heures d'Absence</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Enseignant :</b> <b>${args.teacherNameOrId}</b>
⏳ <b>Heures d'absence :</b> <code>${args.missedHours}h</code> (${monthLabel})
✂️ <b>Impact :</b> Retenue automatique sur le solde de paie

Confirmer l'enregistrement de ces heures d'absence ?`;
    },
    execute: trackTeacherAbsentHoursTool,
  },

  pay_teacher_salary: {
    name: "pay_teacher_salary",
    description: "Enregistrer un versement de salaire ou une avance pour un enseignant avec déduction pour heures d'absence manquées.",
    requiresConfirmation: true,
    declaration: {
      name: "pay_teacher_salary",
      description: "Enregistrer un versement de salaire complet ou une avance sur salaire pour un enseignant.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["teacherNameOrId", "amount"],
        properties: {
          teacherNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'enseignant." },
          amount: { type: SchemaType.NUMBER, description: "Montant payé en Dinars Tunisiens (DT)." },
          month: { type: SchemaType.NUMBER, description: "Mois concerné (1 à 12). Par défaut : mois actuel." },
          year: { type: SchemaType.NUMBER, description: "Année (ex: 2026)." },
          isAdvance: { type: SchemaType.BOOLEAN, description: "VRAI s'il s'agit d'une avance sur salaire (acompte), FAUX pour le solde final." },
          missedHours: { type: SchemaType.NUMBER, description: "Nombre d'heures d'absence à déduire (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const FRENCH_MONTHS = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
      ];
      const now = new Date();
      const targetMonth = args.month || now.getMonth() + 1;
      const targetYear = args.year || now.getFullYear();
      const isAdv = Boolean(args.isAdvance);
      const cleanAmount = Math.abs(Number(args.amount) || 0);
      const typeBadge = isAdv ? "🟡 AVANCE SUR SALAIRE" : "🟢 RÈGLEMENT DU SOLDE DE PAIE";
      const deductionNote = args.missedHours ? `\n⏳ <b>Déduction absence :</b> <code>${args.missedHours}h</code>` : "";
      const monthStr = `\n📅 <b>Période :</b> <code>${FRENCH_MONTHS[targetMonth - 1] || "Mois " + targetMonth} ${targetYear}</code>`;

      return `❓ <b>Confirmation Paiement Enseignant</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Enseignant :</b> <b>${args.teacherNameOrId}</b>
💼 <b>Opération :</b> <b>${typeBadge}</b>
💰 <b>Montant à verser :</b> <code>${cleanAmount} DT</code>${monthStr}${deductionNote}
📝 <b>Catégorie compta :</b> <code>${isAdv ? "Advance" : "Salary"}</code>

Confirmer l'enregistrement et le versement de ce montant ?`;
    },
    execute: payTeacherSalaryTool,
  },

  pay_staff_salary: {
    name: "pay_staff_salary",
    description: "Enregistrer un paiement de salaire ou une avance pour un membre du personnel non-enseignant.",
    requiresConfirmation: true,
    declaration: {
      name: "pay_staff_salary",
      description: "Enregistrer un paiement de salaire ou une avance pour un membre du personnel.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["staffNameOrId", "amount"],
        properties: {
          staffNameOrId: { type: SchemaType.STRING, description: "Nom ou ID du membre du personnel." },
          amount: { type: SchemaType.NUMBER, description: "Montant en DT." },
          month: { type: SchemaType.NUMBER, description: "Mois concerné (1 à 12)." },
          year: { type: SchemaType.NUMBER, description: "Année (ex: 2026)." },
          isAdvance: { type: SchemaType.BOOLEAN, description: "VRAI s'il s'agit d'une avance sur salaire (acompte)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const FRENCH_MONTHS = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
      ];
      const now = new Date();
      const targetMonth = args.month || now.getMonth() + 1;
      const targetYear = args.year || now.getFullYear();
      const isAdv = Boolean(args.isAdvance);
      const cleanAmount = Math.abs(Number(args.amount) || 0);
      const typeBadge = isAdv ? "🟡 AVANCE SUR SALAIRE" : "🟢 RÈGLEMENT DU SOLDE DE PAIE";
      const monthStr = `\n📅 <b>Période :</b> <code>${FRENCH_MONTHS[targetMonth - 1] || "Mois " + targetMonth} ${targetYear}</code>`;

      return `❓ <b>Confirmation Paiement Personnel</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Personnel :</b> <b>${args.staffNameOrId}</b>
💼 <b>Opération :</b> <b>${typeBadge}</b>
💰 <b>Montant à verser :</b> <code>${cleanAmount} DT</code>${monthStr}
📝 <b>Catégorie compta :</b> <code>${isAdv ? "Advance" : "Salary"}</code>

Confirmer l'enregistrement et le versement de ce montant ?`;
    },
    execute: payStaffSalaryTool,
  },

  // ── ATTENDANCE SUITE ──────────────────────────────────────────────────────
  get_attendance: {
    name: "get_attendance",
    description: "Consulter les présences et absences des élèves pour aujourd'hui ou une date donnée.",
    requiresConfirmation: false,
    declaration: {
      name: "get_attendance",
      description: "Consulter les élèves absents ou en retard pour aujourd'hui ou une date.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Date au format AAAA-MM-JJ." },
          className: { type: SchemaType.STRING, description: "Filtrer par classe." },
          status: { type: SchemaType.STRING, description: "'ABSENT', 'LATE', ou 'PRESENT'." },
        },
      },
    },
    execute: getAttendanceTool,
  },

  get_student_attendance_history: {
    name: "get_student_attendance_history",
    description: "Consulter l'historique complet des absences et retards d'un élève (sur toute l'année scolaire ou période choisie), avec taux d'assiduité, absences justifiées vs injustifiées et répartition par matière.",
    requiresConfirmation: false,
    declaration: {
      name: "get_student_attendance_history",
      description: "Consulter les absences, retards et l'assiduité d'un élève sur l'année complète ou une période.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'élève." },
          wholeYear: { type: SchemaType.BOOLEAN, description: "Calculer sur toute l'année scolaire (depuis le 1er septembre). Défaut: true." },
          daysCount: { type: SchemaType.NUMBER, description: "Nombre de jours d'historique si différent de l'année scolaire (ex: 30, 60)." },
        },
      },
    },
    execute: getStudentAttendanceHistoryTool,
  },

  mark_attendance: {
    name: "mark_attendance",
    description: "Pointer un élève comme ABSENT, EN RETARD ou PRÉSENT avec séance, motif et alerte automatique aux parents.",
    requiresConfirmation: true,
    declaration: {
      name: "mark_attendance",
      description: "Enregistrer une absence ou un retard pour un élève (avec séance et motif optionnels).",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "status"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'élève." },
          status: { type: SchemaType.STRING, description: "'ABSENT', 'LATE', ou 'PRESENT'." },
          className: { type: SchemaType.STRING, description: "Classe de l'élève (optionnel, ex: '1A')." },
          sessionName: { type: SchemaType.STRING, description: "Séance / Matière (ex: 'Anglais', 'Maths', '08:00')." },
          date: { type: SchemaType.STRING, description: "Date au format AAAA-MM-JJ si différente d'aujourd'hui." },
          note: { type: SchemaType.STRING, description: "Remarque ou motif (ex: 'Maladie', 'Retard 15 min', 'Transport')." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const statusLabels: Record<string, string> = {
        ABSENT: "ABSENT 🔴",
        LATE: "EN RETARD 🟡",
        PRESENT: "PRÉSENT 🟢",
      };
      const sessionStr = args.sessionName ? ` • Séance : <code>${args.sessionName}</code>` : "";
      const dateStr = args.date ? ` • Date : <code>${args.date}</code>` : "";
      const noteStr = args.note ? `\n📝 <i>Remarque : "${args.note}"</i>` : "";
      return `❓ <b>Pointage Présence</b>\n━━━━━━━━━━━━━━━━━━━━━━\nMarquer <b>${args.studentNameOrId}</b> comme <code>${statusLabels[args.status] || args.status}</code>${sessionStr}${dateStr} ?${noteStr}`;
    },
    execute: markAttendanceTool,
  },

  mark_class_attendance: {
    name: "mark_class_attendance",
    description: "Faire l'appel complet d'une classe pour une séance et une date : marque la classe présente par défaut, avec la liste des absents et des retards.",
    requiresConfirmation: true,
    declaration: {
      name: "mark_class_attendance",
      description: "Faire l'appel d'une classe complète avec séance, absents et retards.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '1A', '3ème B')." },
          date: { type: SchemaType.STRING, description: "Date au format AAAA-MM-JJ (défaut: aujourd'hui)." },
          sessionName: { type: SchemaType.STRING, description: "Séance ou créneau horaire (ex: 'Anglais', '08:00 AM', 'Maths')." },
          defaultStatus: { type: SchemaType.STRING, description: "Statut par défaut du reste de la classe ('PRESENT' ou 'ABSENT'). Défaut: 'PRESENT'." },
          absentStudents: {
            type: SchemaType.ARRAY,
            description: "Liste des prénoms/noms des élèves absents.",
            items: { type: SchemaType.STRING },
          },
          lateStudents: {
            type: SchemaType.ARRAY,
            description: "Liste des élèves en retard avec durée/motif éventuel.",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Nom de l'élève en retard." },
                note: { type: SchemaType.STRING, description: "Motif ou durée (ex: '10 min', '15 min de retard')." },
              },
            },
          },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const absentsStr = args.absentStudents?.length
        ? `\n🔴 <b>Absents (${args.absentStudents.length}) :</b> ${args.absentStudents.join(", ")}`
        : "\n🔴 <b>Absents :</b> <i>Aucun (0)</i>";
      const latesStr = args.lateStudents?.length
        ? `\n🟡 <b>En Retard (${args.lateStudents.length}) :</b> ${args.lateStudents
            .map((l: any) => `${typeof l === "string" ? l : l.name}${l.note ? ` (${l.note})` : ""}`)
            .join(", ")}`
        : "";
      const sessionStr = args.sessionName ? ` • Séance : <code>${args.sessionName}</code>` : "";
      const dateStr = args.date ? ` • Date : <code>${args.date}</code>` : "";
      return `❓ <b>Appel de Classe • ${args.className}</b>\n━━━━━━━━━━━━━━━━━━━━━━${sessionStr}${dateStr}\n🟢 <b>Reste de la classe :</b> <code>Présents</code>${absentsStr}${latesStr}\n\nEnregistrer cet appel et notifier les familles concernées ?`;
    },
    execute: markClassAttendanceTool,
  },

  // ── GRADES & EXAMS SUITE ──────────────────────────────────────────────────
  get_student_grades: {
    name: "get_student_grades",
    description: "Consulter les notes d'un élève par trimestre et sa moyenne générale.",
    requiresConfirmation: false,
    declaration: {
      name: "get_student_grades",
      description: "Consulter les notes et la moyenne d'un élève.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'élève." },
          term: { type: SchemaType.NUMBER, description: "Trimestre (1, 2, ou 3)." },
        },
      },
    },
    execute: getStudentGradesTool,
  },

  get_class_grade_sheet: {
    name: "get_class_grade_sheet",
    description: "Consulter le relevé de notes d'une classe entière pour une matière (moyenne de classe, note max, note min).",
    requiresConfirmation: false,
    declaration: {
      name: "get_class_grade_sheet",
      description: "Consulter le relevé des notes de toute une classe pour une matière.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className", "subjectName"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '8ème B')." },
          subjectName: { type: SchemaType.STRING, description: "Matière (ex: 'Mathématiques')." },
          term: { type: SchemaType.NUMBER, description: "Trimestre (1, 2, ou 3)." },
        },
      },
    },
    execute: getClassGradeSheetTool,
  },

  get_exams: {
    name: "get_exams",
    description: "Consulter les examens et devoirs surveillés à venir.",
    requiresConfirmation: false,
    declaration: {
      name: "get_exams",
      description: "Consulter les prochains examens programmés.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          className: { type: SchemaType.STRING, description: "Filtrer par nom de classe." },
          upcomingOnly: { type: SchemaType.BOOLEAN, description: "Uniquement les examens futurs." },
        },
      },
    },
    execute: getExamsTool,
  },

  record_grade: {
    name: "record_grade",
    description: "Enregistrer une note sur 20 pour un élève dans une matière pour un trimestre.",
    requiresConfirmation: true,
    declaration: {
      name: "record_grade",
      description: "Enregistrer la note d'un élève dans une matière.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "subjectName", "score"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'élève." },
          subjectName: { type: SchemaType.STRING, description: "Nom de la matière." },
          score: { type: SchemaType.NUMBER, description: "Note obtenue entre 0 et 20." },
          term: { type: SchemaType.NUMBER, description: "Trimestre (1, 2, ou 3, défaut : 1)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Saisie de Note</b>\n━━━━━━━━━━━━━━━━━━━━━━\nEnregistrer la note <code>${args.score} / 20</code> en <b>${args.subjectName}</b> pour <b>${args.studentNameOrId}</b> (Trimestre <code>${args.term || 1}</code>) ?`;
    },
    execute: recordGradeTool,
  },

  schedule_exam: {
    name: "schedule_exam",
    description: "Planifier un examen ou devoir surveillé avec date, horaire, classe et matière.",
    requiresConfirmation: true,
    declaration: {
      name: "schedule_exam",
      description: "Planifier un examen pour une classe.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "className", "subjectName", "date"],
        properties: {
          title: { type: SchemaType.STRING, description: "Titre (ex: 'Devoir de synthèse N°1')." },
          className: { type: SchemaType.STRING, description: "Nom de la classe." },
          subjectName: { type: SchemaType.STRING, description: "Matière concernée." },
          date: { type: SchemaType.STRING, description: "Date au format AAAA-MM-JJ." },
          startTime: { type: SchemaType.STRING, description: "Heure de début (ex: '08:30')." },
          endTime: { type: SchemaType.STRING, description: "Heure de fin (ex: '10:30')." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Planification d'Examen</b>\n━━━━━━━━━━━━━━━━━━━━━━\nPlanifier <b>${args.title}</b> (${args.subjectName}) pour la classe <code>${args.className}</code> le <code>${args.date}</code> ?`;
    },
    execute: scheduleExamTool,
  },

  // ── FINANCE SUITE ─────────────────────────────────────────────────────────
  get_payments: {
    name: "get_payments",
    description: "Consulter la situation complète des paiements et impayés de scolarité pour un mois/année donné. Indique les élèves à jour (payés), les paiements partiels (avec reliquats), ET les élèves totalement non payés (qui n'ont encore rien versé 0 DT). Peut être filtré par classe, par nom d'élève ou par nom/téléphone de parent. À UTILISER IMPÉRATIVEMENT quand l'administrateur demande qui a payé, qui n'a pas payé ('شكون ما خلصش', 'qui doit de l'argent ce mois', 'situation des impayés').",
    requiresConfirmation: false,
    declaration: {
      name: "get_payments",
      description: "Vérifier le statut complet des frais de scolarité (payés, partiels et non payés 0 DT) pour un mois/année.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          month: { type: SchemaType.NUMBER, description: "Numéro du mois (1 à 12, optionnel. Par défaut : mois actuel en cours)." },
          year: { type: SchemaType.NUMBER, description: "Année (ex: 2026, optionnel. Par défaut : année actuelle)." },
          status: { type: SchemaType.STRING, description: "'UNPAID' (pour voir tous les élèves avec solde dû : 0 DT et partiels), 'PAID', ou 'PARTIAL'." },
          className: { type: SchemaType.STRING, description: "Filtrer par nom de classe (ex: '7ème B')." },
          studentName: { type: SchemaType.STRING, description: "Filtrer par nom ou prénom d'élève." },
          parentName: { type: SchemaType.STRING, description: "Filtrer par nom, prénom ou téléphone du parent (ex: 'moune saoud', '6458558')." },
        },
      },
    },
    execute: getPaymentsTool,
  },

  get_partial_payments: {
    name: "get_partial_payments",
    description: "Consulter UNIQUEMENT la file des paiements partiels (/list/payments-partial) pour les dossiers ayant déjà un acompte avec promesse de paiement ou date d'échéance. (Pour la liste globale de qui n'a pas payé ou les impayés du mois, utiliser get_payments).",
    requiresConfirmation: false,
    declaration: {
      name: "get_partial_payments",
      description: "Obtenir la liste complète des dossiers de paiements partiels et les indicateurs de recouvrement (KPIs).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          status: {
            type: SchemaType.STRING,
            description: "Filtrer par statut: 'all' (recommandé pour voir toute la file), 'overdue' (échus), 'this_month' (ce mois), 'future' (futurs), ou 'unscheduled'.",
          },
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '8ème B')." },
          studentName: { type: SchemaType.STRING, description: "Nom ou prénom de l'élève." },
          month: { type: SchemaType.NUMBER, description: "Mois numérique (1 à 12, optionnel)." },
          year: { type: SchemaType.NUMBER, description: "Année (optionnel)." },
        },
      },
    },
    execute: getPartialPaymentsTool,
  },

  recover_partial_payment: {
    name: "recover_partial_payment",
    description: "Recouvrer / encaisser le reliquat d'un paiement partiel de scolarité pour un élève (bouton RECOUVRER du tableau de bord).",
    requiresConfirmation: true,
    declaration: {
      name: "recover_partial_payment",
      description: "Recouvrer ou encaisser tout ou partie d'un reliquat de paiement partiel pour un élève.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève." },
          amount: { type: SchemaType.NUMBER, description: "Montant encaissé en DT (optionnel, solde tout le reliquat par défaut)." },
          month: { type: SchemaType.NUMBER, description: "Mois ciblé (1 à 12, optionnel)." },
          year: { type: SchemaType.NUMBER, description: "Année (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: async (args, context) => {
      const q = (args.studentNameOrId || "").trim();
      const student = await prisma.student.findFirst({
        where: {
          schoolId: context.schoolId,
          OR: [
            { id: q },
            { name: { contains: q, mode: "insensitive" } },
            { surname: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { class: true },
      });

      const now = new Date();
      const targetMonth = args.month || now.getMonth() + 1;
      const targetYear = args.year || now.getFullYear();
      const monthLabel = formatMonthFrench(`${MONTHS[targetMonth - 1]} ${targetYear}`);

      const studentDisplay = student ? `${student.name} ${student.surname} (Classe : ${student.class?.name || "N/A"})` : args.studentNameOrId;
      const amountStr = args.amount ? `<code>${args.amount} DT</code>` : "<b>la totalité du reliquat restant</b>";

      return `❓ <b>Confirmation de Recouvrement</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Élève :</b> <b>${studentDisplay}</b>
📅 <b>Mois concerné :</b> <code>${monthLabel}</code>
💰 <b>Montant :</b> ${amountStr}

Souhaitez-vous enregistrer le recouvrement de ${amountStr} pour <b>${studentDisplay}</b> (${monthLabel}) ?`;
    },
    execute: recoverPartialPaymentTool,
  },

  schedule_recovery_date: {
    name: "schedule_recovery_date",
    description: "Fixer ou mettre à jour la date d'échéance promise pour le recouvrement d'un reliquat partiel.",
    requiresConfirmation: true,
    declaration: {
      name: "schedule_recovery_date",
      description: "Fixer la date limite de paiement promise (deferredUntil) pour un dossier partiel.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "date"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève." },
          date: { type: SchemaType.STRING, description: "Date promise au format AAAA-MM-JJ (ex: '2026-09-25')." },
          month: { type: SchemaType.NUMBER, description: "Mois concerné (optionnel)." },
          year: { type: SchemaType.NUMBER, description: "Année concernée (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Planification d'Échéance</b>\n━━━━━━━━━━━━━━━━━━━━━━\nFixer la date limite de recouvrement pour <b>${args.studentNameOrId}</b> au <code>${args.date}</code> ?`;
    },
    execute: scheduleRecoveryDateTool,
  },

  get_financial_summary: {
    name: "get_financial_summary",
    description: "Bilan financier : total revenus, dépenses, bénéfice net et impayés.",
    requiresConfirmation: false,
    declaration: {
      name: "get_financial_summary",
      description: "Obtenir les chiffres clés financiers de l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          month: { type: SchemaType.NUMBER, description: "Mois numérique (1 à 12)." },
          year: { type: SchemaType.NUMBER, description: "Année." },
        },
      },
    },
    execute: getFinancialSummaryTool,
  },

  get_financial_anomalies: {
    name: "get_financial_anomalies",
    description: "Détecter les anomalies financières (impayés chroniques sur 2+ mois, dépenses inhabituelles élevées).",
    requiresConfirmation: false,
    declaration: {
      name: "get_financial_anomalies",
      description: "Détecter les anomalies financières et retards chroniques.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          month: { type: SchemaType.NUMBER, description: "Mois numérique." },
          year: { type: SchemaType.NUMBER, description: "Année." },
        },
      },
    },
    execute: getFinancialAnomaliesTool,
  },

  record_payment: {
    name: "record_payment",
    description: "Enregistrer un versement libre de scolarité reçu d'une famille (gère la ventilation multi-mois automatique de septembre à juin et les soldes partiels).",
    requiresConfirmation: true,
    declaration: {
      name: "record_payment",
      description: "Enregistrer un versement libre de scolarité en Dinars Tunisiens (DT) avec répartition multi-mois automatique.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "amount"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève." },
          amount: { type: SchemaType.NUMBER, description: "Montant reçu en DT (ex: 450, 1000, 200)." },
          month: { type: SchemaType.NUMBER, description: "Mois de début ou mois ciblé (1 à 12, optionnel : commence au 1er impayé par défaut)." },
          year: { type: SchemaType.NUMBER, description: "Année (ex: 2026, optionnel)." },
        },
      },
    },
    formatConfirmationMessage: async (args, context) => {
      const query = (args.studentNameOrId || "").trim();
      const student = await resolveStudentByName(context.schoolId, query);

      const now = new Date();
      const targetMonth = args.month || now.getMonth() + 1;
      const targetYear = args.year || now.getFullYear();
      const monthLabel = formatMonthFrench(`${MONTHS[targetMonth - 1]} ${targetYear}`);

      if (!student) {
        return `❓ <b>Confirmation de Paiement</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous enregistrer le versement de <code>${args.amount} DT</code> pour <b>${args.studentNameOrId}</b> (${monthLabel}) ?`;
      }

      const allocation = await calculateStudentPaymentAllocation(
        student.id,
        args.amount,
        context.schoolId,
        targetMonth,
        targetYear
      );

      if (!allocation || allocation.paymentsToProcess.length === 0) {
        return `❓ <b>Confirmation de Paiement</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous enregistrer le versement de <code>${args.amount} DT</code> pour <b>${student.name} ${student.surname}</b> (${monthLabel}) ?`;
      }

      const lines = allocation.paymentsToProcess.map((p) => {
        const frMonth = formatMonthFrench(p.monthYear);
        const badge = p.isPartial
          ? `⚠️ <code>PARTIEL</code> (Reçu <code>${p.amount} DT</code> • Reste <code>${p.gap} DT</code>)`
          : `✅ <code>SOLDÉ</code> (<code>${p.amount} DT</code>)`;
        return `• <b>${frMonth}</b> : ${badge}`;
      });

      return `❓ <b>Confirmation de Paiement</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>${student.name} ${student.surname}</b> • Classe <code>${student.class?.name || "Sans classe"}</code>
📅 <b>Mois concerné :</b> <code>${monthLabel}</code>
💰 Versement reçu : <code>${args.amount} DT</code>

📋 <b>Ventilation automatique calculée :</b>
${lines.join("\n")}

Souhaitez-vous enregistrer ce versement pour <b>${student.name} ${student.surname}</b> (${monthLabel}) ?`;
    },
    execute: recordPaymentTool,
  },

  record_parent_payment: {
    name: "record_parent_payment",
    description: "Encaisser un versement global d'un parent pour régler la scolarité de ses enfants, avec ventilation automatique et intelligente entre les enfants ayant des impayés (ex: 'haw khalesni fihom 300', 'a réglé 300 DT between his kids', 'il m'a donné 300 pour ses deux filles').",
    requiresConfirmation: true,
    declaration: {
      name: "record_parent_payment",
      description: "Encaisser un paiement d'un parent et ventiler automatiquement la somme entre ses enfants endettés.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["parentNameOrId", "amount"],
        properties: {
          parentNameOrId: {
            type: SchemaType.STRING,
            description: "Nom, prénom ou téléphone du parent (ex: 'fares selmi', '123456789').",
          },
          amount: {
            type: SchemaType.NUMBER,
            description: "Montant total versé par le parent en Dinars Tunisiens (ex: 300).",
          },
          month: {
            type: SchemaType.NUMBER,
            description: "Mois cible (1 à 12, optionnel. Par défaut : mois actuel).",
          },
          year: {
            type: SchemaType.NUMBER,
            description: "Année (optionnel, par défaut : année actuelle).",
          },
        },
      },
    },
    formatConfirmationMessage: async (args, context) => {
      const parent = await resolveParentByName(context.schoolId, args.parentNameOrId);
      const now = new Date();
      const targetMonth = args.month || now.getMonth() + 1;
      const targetYear = args.year || now.getFullYear();
      const monthLabel = formatMonthFrench(`${MONTHS[targetMonth - 1]} ${targetYear}`);

      if (!parent) {
        return `❓ <b>Confirmation de Paiement Parental</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous enregistrer le versement de <code>${args.amount} DT</code> du parent <b>${args.parentNameOrId}</b> (${monthLabel}) ?`;
      }

      const dist = await calculateParentPaymentDistribution(
        parent.id,
        args.amount,
        context.schoolId,
        targetMonth,
        targetYear
      );

      if (!dist || dist.allocations.length === 0) {
        return `❓ <b>Confirmation de Paiement Parental</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Parent :</b> <b>${parent.name} ${parent.surname}</b>\n📅 <b>Mois concerné :</b> <code>${monthLabel}</code>\n💰 Montant : <code>${args.amount} DT</code>\n\nTous les enfants de ce parent semblent déjà en règle pour ${monthLabel}. Confirmer le versement ?`;
      }

      const lines = dist.allocations.map((a) => {
        const badge = a.isFullyCleared ? "✅ <code>SOLDÉ</code>" : `⚠️ <code>PARTIEL</code> (Reste : <code>${a.remainingAfter} DT</code>)`;
        return `• <b>${a.studentName}</b> (<code>${a.className}</code>) : <code>${a.amount} DT</code> (${badge})`;
      });

      return `❓ <b>Confirmation : Règlement Parental Multi-Enfants</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Parent :</b> <b>${parent.name} ${parent.surname}</b>
📅 <b>Mois concerné :</b> <code>${monthLabel}</code>
💰 <b>Montant total versé :</b> <code>${args.amount} DT</code>

📋 <b>Ventilation automatique calculée :</b>
${lines.join("\n")}

Souhaitez-vous valider ce règlement pour les ${dist.allocations.length} enfants (${monthLabel}) ?`;
    },
    execute: recordParentPaymentTool,
  },

  get_incomes: {
    name: "get_incomes",
    description: "Consulter les recettes et revenus de l'école (chiffres du mois, total historique, ventilation par catégorie).",
    requiresConfirmation: false,
    declaration: {
      name: "get_incomes",
      description: "Consulter les revenus de l'école avec totaux et répartition par catégorie.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Date précise au format AAAA-MM-JJ ou 'today' pour les recettes du jour." },
          month: { type: SchemaType.NUMBER, description: "Mois numérique (1 à 12, défaut mois actuel)." },
          year: { type: SchemaType.NUMBER, description: "Année (défaut année actuelle)." },
          category: { type: SchemaType.STRING, description: "Filtrer par catégorie (ex: 'Tuition', 'Cantine', 'Transport', 'Général')." },
          query: { type: SchemaType.STRING, description: "Rechercher par mot-clé dans l'intitulé." },
          limit: { type: SchemaType.NUMBER, description: "Nombre maximum de résultats (défaut 25)." },
        },
      },
    },
    execute: getIncomesTool,
  },

  add_income: {
    name: "add_income",
    description: "Enregistrer une recette ou un revenu pour l'école (scolarité, cantine, transport, bus scolaire, activités, dons, subventions, événements, etc.).",
    requiresConfirmation: true,
    declaration: {
      name: "add_income",
      description: "Enregistrer un nouveau revenu encaissé par l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "amount", "category"],
        properties: {
          title: { type: SchemaType.STRING, description: "Intitulé ou source de la recette (ex: 'Abonnement Bus 01', 'Forfait Cantine Octobre', 'Donation association')." },
          amount: { type: SchemaType.NUMBER, description: "Montant encaissé en Dinars Tunisiens (DT)." },
          category: {
            type: SchemaType.STRING,
            description: "Catégorie du revenu : 'Tuition' (Scolarité/Inscriptions), 'Cantine', 'Transport' (ou 'BUS01', 'BUS02'), 'Dons' (Donations), 'Events' (Événements/Fêtes), 'GRANT' (Subventions), 'Recovery' (Recouvrement reliquats), ou catégorie personnalisée.",
          },
          date: { type: SchemaType.STRING, description: "Date au format AAAA-MM-JJ (optionnel, aujourd'hui par défaut)." },
          img: { type: SchemaType.STRING, description: "URL du reçu ou justificatif (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: async (args, context) => {
      const cleanAmount = Math.abs(Number(args.amount) || 0);
      const title = (args.title || "Revenu").trim();
      const rawCategory = (args.category || "Général").trim();
      const incomeDate = args.date ? new Date(args.date) : new Date();
      const dateStr = !isNaN(incomeDate.getTime())
        ? incomeDate.toLocaleDateString("fr-FR")
        : new Date().toLocaleDateString("fr-FR");
      const imgStr = args.img ? "\n🖼️ <i>Justificatif joint</i>" : "";

      // Check if category already exists in database for this school
      const existingInDb = await prisma.income.findFirst({
        where: {
          schoolId: context.schoolId,
          category: { equals: rawCategory, mode: "insensitive" },
        },
        select: { category: true },
      });

      const STANDARD_INCOME_CATS = [
        "tuition", "scolarité", "frais scolaires", "inscriptions",
        "cantine", "repas", "transport", "bus", "dons", "donations",
        "events", "événements", "grant", "subventions", "recovery",
      ];
      const isStandard = STANDARD_INCOME_CATS.includes(rawCategory.toLowerCase());

      const categoryLabel = existingInDb
        ? `<code>${existingInDb.category}</code> (Catégorie existante ✅)`
        : isStandard
        ? `<code>${rawCategory}</code> (Catégorie standard ✅)`
        : `<code>${rawCategory}</code> (Nouvelle catégorie 🆕)`;

      return `❓ <b>Nouveau Revenu</b>
━━━━━━━━━━━━━━━━━━━━━━
💰 <b>Montant :</b> <code>+${cleanAmount} DT</code>
🏷️ <b>Intitulé / Source :</b> <b>${title}</b>
📂 <b>Catégorie :</b> ${categoryLabel}
📅 <b>Date :</b> <code>${dateStr}</code>${imgStr}

Confirmer l'enregistrement de ce revenu ?`;
    },
    execute: addIncomeTool,
  },

  get_expenses: {
    name: "get_expenses",
    description: "Consulter les dépenses opérationnelles de l'école (chiffres du mois, total historique, ventilation par catégorie, ex: total dépensé pour BUS01, BUS02, Transport, Loyer).",
    requiresConfirmation: false,
    declaration: {
      name: "get_expenses",
      description: "Consulter les dépenses de l'école avec totaux et ventilation par catégorie (ex: BUS01, BUS02, Transport, Loyer, Fournitures).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          month: { type: SchemaType.NUMBER, description: "Mois (1 à 12, optionnel : omettre pour voir l'historique complet de la catégorie)." },
          year: { type: SchemaType.NUMBER, description: "Année (optionnel)." },
          category: { type: SchemaType.STRING, description: "Filtrer par catégorie (ex: 'BUS02', 'BUS01', 'Transport', 'Factures', 'Fournitures', 'Maintenance', 'Loyer')." },
          query: { type: SchemaType.STRING, description: "Recherche textuelle dans l'intitulé." },
          limit: { type: SchemaType.NUMBER, description: "Nombre maximum de résultats (défaut 25)." },
        },
      },
    },
    execute: getExpensesTool,
  },

  add_expense: {
    name: "add_expense",
    description: "Enregistrer une dépense opérationnelle (carburant/essence, transport/bus, facture STEG/SONEDE, fournitures, entretien, loyer, restauration, etc.).",
    requiresConfirmation: true,
    declaration: {
      name: "add_expense",
      description: "Enregistrer une dépense payée par l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "amount"],
        properties: {
          title: { type: SchemaType.STRING, description: "Description de la dépense (ex: 'Achat essence bus01', 'Facture STEG Septembre', 'Fournitures papier A4')." },
          amount: { type: SchemaType.NUMBER, description: "Montant en Dinars Tunisiens (DT)." },
          category: {
            type: SchemaType.STRING,
            description: "Catégorie : 'Transport' (ou véhicules 'BUS01', 'BUS02', 'FUEL'), 'Factures' (ou 'Electricity', 'Water'), 'Fournitures' (ou 'SUPPLIES'), 'Maintenance', 'Loyer', 'Restauration', 'Salary', 'Advance', ou catégorie personnalisée.",
          },
          date: { type: SchemaType.STRING, description: "Date au format AAAA-MM-JJ." },
          img: { type: SchemaType.STRING, description: "URL de la facture ou du reçu / justificatif (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: async (args, context) => {
      const cleanAmount = Math.abs(Number(args.amount) || 0);
      const title = (args.title || "Dépense").trim();
      const rawCategory = (args.category || "Général").trim();
      const expenseDate = args.date ? new Date(args.date) : new Date();
      const dateStr = !isNaN(expenseDate.getTime())
        ? expenseDate.toLocaleDateString("fr-FR")
        : new Date().toLocaleDateString("fr-FR");
      const imgStr = args.img ? "\n🖼️ <i>Reçu / justificatif joint</i>" : "";

      // Check if category already exists in database for this school
      const existingInDb = await prisma.expense.findFirst({
        where: {
          schoolId: context.schoolId,
          category: { equals: rawCategory, mode: "insensitive" },
        },
        select: { category: true },
      });

      const STANDARD_EXPENSE_CATS = [
        "transport", "fuel", "carburant", "essence", "mazout", "bus", "bus01", "bus02",
        "factures", "electricity", "water", "internet", "téléphone", "services",
        "fournitures", "supplies", "maintenance", "entretien", "loyer", "restauration",
        "salary", "salaire", "advance", "avance",
      ];
      const isStandard = STANDARD_EXPENSE_CATS.includes(rawCategory.toLowerCase());

      const categoryLabel = existingInDb
        ? `<code>${existingInDb.category}</code> (Catégorie existante ✅)`
        : isStandard
        ? `<code>${rawCategory}</code> (Catégorie standard ✅)`
        : `<code>${rawCategory}</code> (Nouvelle catégorie 🆕)`;

      return `❓ <b>Nouvelle Dépense</b>
━━━━━━━━━━━━━━━━━━━━━━
💰 <b>Montant :</b> <code>${cleanAmount} DT</code>
🏷️ <b>Intitulé :</b> <b>${title}</b>
📂 <b>Catégorie :</b> ${categoryLabel}
📅 <b>Date :</b> <code>${dateStr}</code>${imgStr}

Confirmer l'enregistrement de cette dépense ?`;
    },
    execute: addExpenseTool,
  },

  send_payment_reminders: {
    name: "send_payment_reminders",
    description: "Déclencher l'envoi de rappels de paiement (push et notifications) aux parents des élèves ayant des impayés (global, par classe ou par élève).",
    requiresConfirmation: true,
    declaration: {
      name: "send_payment_reminders",
      description: "Envoyer des notifications de rappel de paiement aux familles avec scolarité impayée.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          force: { type: SchemaType.BOOLEAN, description: "Forcer l'envoi même si un rappel a été envoyé récemment." },
          studentName: { type: SchemaType.STRING, description: "Nom ou prénom d'un élève spécifique pour lui envoyer un rappel ciblé (optionnel)." },
          className: { type: SchemaType.STRING, description: "Nom de la classe pour cibler uniquement les impayés de cette classe (ex: '7ème A') (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: (args: any) => {
      let target = "toutes les familles ayant des impayés";
      if (args?.studentName) target = `la famille de l'élève <b>${args.studentName}</b>`;
      else if (args?.className) target = `les familles de la classe <b>${args.className}</b>`;
      return `❓ <b>Rappels de Paiement Mobile</b>\n━━━━━━━━━━━━━━━━━━━━━━\nEnvoyer une notification push et in-app de rappel à <b>${target}</b> ?`;
    },
    execute: sendPaymentRemindersTool,
  },

  send_parent_message: {
    name: "send_parent_message",
    description: "Envoyer une notification mobile et push directe aux parents d'un élève, d'une classe, aux impayés ou à toute l'école.",
    requiresConfirmation: true,
    declaration: {
      name: "send_parent_message",
      description: "Envoyer un message ou notification mobile push aux parents d'élèves (un élève, une classe, impayés ou tous).",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["message"],
        properties: {
          message: { type: SchemaType.STRING, description: "Le contenu du message à envoyer aux parents sur leur application mobile." },
          title: { type: SchemaType.STRING, description: "Titre de la notification (ex: 'Rappel important', 'Convocation', 'Frais de scolarité')." },
          studentName: { type: SchemaType.STRING, description: "Nom de l'élève si le message vise les parents d'un élève en particulier." },
          className: { type: SchemaType.STRING, description: "Nom de la classe si le message vise les parents d'une classe (ex: '1ère A', '7ème B')." },
          target: {
            type: SchemaType.STRING,
            description: "Cible du message: 'student' (élève spécifique), 'class' (classe entière), 'unpaid' (tous les parents ayant des impayés), ou 'all' (toute l'école).",
          },
          type: {
            type: SchemaType.STRING,
            description: "Type de notification: 'MESSAGE', 'PAYMENT', 'REMINDER', 'ANNOUNCEMENT', 'ATTENDANCE'.",
          },
        },
      },
    },
    formatConfirmationMessage: (args: any) => {
      let targetLabel = "toutes les familles de l'école";
      if (args?.studentName) targetLabel = `les parents de <b>${args.studentName}</b>`;
      else if (args?.className) targetLabel = `les parents de la classe <b>${args.className}</b>`;
      else if (args?.target === "unpaid") targetLabel = "tous les parents ayant un solde impayé";

      const title = args?.title || "Message de l'administration";
      return `❓ <b>Envoi Notification Mobile aux Parents</b>\n━━━━━━━━━━━━━━━━━━━━━━\n🎯 <b>Destinataire(s) :</b> ${targetLabel}\n📌 <b>Titre :</b> ${title}\n💬 <b>Message :</b> <i>"${args?.message}"</i>\n\nConfirmer l'envoi de cette notification push mobile ?`;
    },
    execute: sendParentMessageTool,
  },

  // ── TIMETABLE & SUBSTITUTION SUITE ────────────────────────────────────────
  get_class_timetable: {
    name: "get_class_timetable",
    description: "Consulter l'emploi du temps d'une classe pour un jour ou toute la semaine.",
    requiresConfirmation: false,
    declaration: {
      name: "get_class_timetable",
      description: "Consulter l'emploi du temps d'une classe.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '8ème B')." },
          day: { type: SchemaType.STRING, description: "Jour (ex: 'lundi', 'mardi', 'vendredi')." },
        },
      },
    },
    execute: getClassTimetableTool,
  },

  find_available_teachers: {
    name: "find_available_teachers",
    description: "Rechercher les enseignants libres pendant un créneau horaire pour un remplacement d'urgence.",
    requiresConfirmation: false,
    declaration: {
      name: "find_available_teachers",
      description: "Trouver les enseignants libres à un jour et horaire donnés pour un remplacement d'urgence.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["day", "timeSlot"],
        properties: {
          day: { type: SchemaType.STRING, description: "Jour (ex: 'mardi', 'mercredi')." },
          timeSlot: { type: SchemaType.STRING, description: "Créneau ou heure (ex: '10:00' ou '08:00 - 10:00')." },
          subjectName: { type: SchemaType.STRING, description: "Matière recherchée (ex: 'Mathématiques')." },
        },
      },
    },
    execute: findAvailableTeachersTool,
  },

  add_timetable_slot: {
    name: "add_timetable_slot",
    description: "Ajouter une séance de cours dans l'emploi du temps d'une classe.",
    requiresConfirmation: true,
    declaration: {
      name: "add_timetable_slot",
      description: "Ajouter un créneau de cours à l'emploi du temps.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className", "subjectName", "teacherName", "day", "startTime", "endTime"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe." },
          subjectName: { type: SchemaType.STRING, description: "Nom de la matière." },
          teacherName: { type: SchemaType.STRING, description: "Nom de l'enseignant." },
          day: { type: SchemaType.STRING, description: "Jour (ex: 'lundi', 'mardi')." },
          startTime: { type: SchemaType.STRING, description: "Heure de début (ex: '08:00')." },
          endTime: { type: SchemaType.STRING, description: "Heure de fin (ex: '10:00')." },
          room: { type: SchemaType.STRING, description: "Salle de classe (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Ajout de Séance</b>\n━━━━━━━━━━━━━━━━━━━━━━\nAjouter <b>${args.subjectName}</b> pour <code>${args.className}</code> avec <b>${args.teacherName}</b> le <b>${args.day}</b> (<code>${args.startTime} - ${args.endTime}</code>) ?`;
    },
    execute: addTimetableSlotTool,
  },

  // ── COMMUNICATION SUITE (/list/announcements) ─────────────────────────────
  get_announcements: {
    name: "get_announcements",
    description: "Consulter la liste des annonces et communications officielles de l'école (filtrable par classe, urgence, mot-clé).",
    requiresConfirmation: false,
    declaration: {
      name: "get_announcements",
      description: "Consulter les annonces scolaires publiées avec leur portée, niveau d'urgence et pièces jointes.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '1A', 'Général'). Omettre pour toutes." },
          scope: { type: SchemaType.STRING, description: "Portée : 'all' (toutes), 'global' (toute l'école), ou 'class' (ciblées)." },
          importantOnly: { type: SchemaType.BOOLEAN, description: "Si true, retourne uniquement les annonces marquées comme URGENT." },
          search: { type: SchemaType.STRING, description: "Recherche par mot-clé dans le titre ou le message." },
          limit: { type: SchemaType.NUMBER, description: "Nombre maximum d'annonces à retourner (défaut : 10)." },
        },
      },
    },
    execute: getAnnouncementsTool,
  },

  post_announcement: {
    name: "post_announcement",
    description: "Publier une annonce officielle pour toute l'école, une classe spécifique ou un élève avec niveau d'urgence, images et documents joints.",
    requiresConfirmation: true,
    declaration: {
      name: "post_announcement",
      description: "Publier une annonce / avis officiel visible par les familles et parents.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "message"],
        properties: {
          title: { type: SchemaType.STRING, description: "Titre de l'annonce (ex: 'Calendrier des examens')." },
          message: { type: SchemaType.STRING, description: "Contenu détaillé de l'annonce." },
          className: { type: SchemaType.STRING, description: "Portée : 'Général' (ou vide) pour toute l'école, ou nom de classe ex: '1A'." },
          important: { type: SchemaType.BOOLEAN, description: "Marquer comme URGENT (alerte push prioritaire avec badge rouge)." },
          img: { type: SchemaType.STRING, description: "URL(s) de photos ou affiches jointes (séparées par virgule)." },
          pdfUrl: { type: SchemaType.STRING, description: "URL(s) de documents joints (PDF, Word, etc.)." },
          studentName: { type: SchemaType.STRING, description: "Nom d'un élève si l'annonce est réservée à un élève spécifique." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const target = args.studentName
        ? `l'élève <b>${args.studentName}</b>`
        : args.className && !["general", "général", "all", "toutes"].includes(args.className.toLowerCase().trim())
        ? `la classe <code>${args.className}</code>`
        : "<b>toute l'école (Général)</b>";
      const urgentBadge = args.important ? " 🚨 <code>URGENT</code>" : "";
      const imgBadge = args.img ? "\n🖼️ <i>Affiche / Image(s) jointe(s)</i>" : "";
      const docBadge = args.pdfUrl ? "\n📄 <i>Document(s) joint(s)</i>" : "";
      const preview = args.message.length > 200 ? `${args.message.slice(0, 197)}...` : args.message;
      return `❓ <b>Confirmation de Publication d'Annonce</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>${args.title}</b>\n🎯 Destinataires : ${target}${urgentBadge}${imgBadge}${docBadge}\n\n📝 <i>"${preview}"</i>\n\nConfirmer la diffusion aux familles et l'envoi des notifications push ?`;
    },
    execute: postAnnouncementTool,
  },

  create_announcement: {
    name: "create_announcement",
    description: "Créer et diffuser une nouvelle annonce scolaire (alias de post_announcement).",
    requiresConfirmation: true,
    declaration: {
      name: "create_announcement",
      description: "Créer une annonce officielle pour l'école ou une classe.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "message"],
        properties: {
          title: { type: SchemaType.STRING, description: "Titre de l'annonce." },
          message: { type: SchemaType.STRING, description: "Contenu détaillé." },
          className: { type: SchemaType.STRING, description: "Classe ciblée ou 'Général'." },
          important: { type: SchemaType.BOOLEAN, description: "Marquer comme URGENT." },
          img: { type: SchemaType.STRING, description: "URL de l'image / affiche." },
          pdfUrl: { type: SchemaType.STRING, description: "URL du document." },
          studentName: { type: SchemaType.STRING, description: "Nom de l'élève ciblé." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const target = args.className ? `la classe <code>${args.className}</code>` : "<b>toute l'école (Général)</b>";
      const urgentBadge = args.important ? " 🚨 <code>URGENT</code>" : "";
      return `❓ <b>Création d'Annonce</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>${args.title}</b>\n🎯 Portée : ${target}${urgentBadge}\n\nConfirmer la publication ?`;
    },
    execute: postAnnouncementTool,
  },

  delete_announcement: {
    name: "delete_announcement",
    description: "Supprimer une annonce scolaire par son identifiant ou par son titre.",
    requiresConfirmation: true,
    declaration: {
      name: "delete_announcement",
      description: "Supprimer une annonce officielle publiée.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          announcementId: { type: SchemaType.NUMBER, description: "ID de l'annonce." },
          title: { type: SchemaType.STRING, description: "Titre ou mot-clé de l'annonce à supprimer." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const target = args.title ? `"${args.title}"` : `ID #${args.announcementId}`;
      return `❓ <b>Suppression d'Annonce</b>\n━━━━━━━━━━━━━━━━━━━━━━\nÊtes-vous sûr de vouloir supprimer définitivement l'annonce <b>${target}</b> ?`;
    },
    execute: deleteAnnouncementTool,
  },

  // ── TASKS & ASSIGNMENTS SUITE (/list/assignments) ─────────────────────────
  get_assignments: {
    name: "get_assignments",
    description: "Consulter la liste des tâches scolaires et devoirs à la maison (filtrable par classe, matière, devoirs à venir ou passés).",
    requiresConfirmation: false,
    declaration: {
      name: "get_assignments",
      description: "Consulter et filtrer les tâches scolaires et devoirs des élèves.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '1A', '3B'). Optionnel." },
          subjectName: { type: SchemaType.STRING, description: "Nom de la matière (ex: 'Mathématiques', 'Anglais'). Optionnel." },
          filter: {
            type: SchemaType.STRING,
            description: "Filtre par statut temporel : 'upcoming' (à venir / non échus), 'past' (passés / échus), ou 'all' (tous). Par défaut 'all'.",
          },
          limit: { type: SchemaType.NUMBER, description: "Nombre maximum de tâches à retourner (par défaut 20)." },
        },
      },
    },
    execute: getAssignmentsTool,
  },

  create_assignment: {
    name: "create_assignment",
    description: "Créer une nouvelle tâche scolaire ou un devoir à la maison pour une classe avec matière, titre, date limite, instructions et document/photo joint. Notifie immédiatement les parents et élèves via notification push.",
    requiresConfirmation: true,
    declaration: {
      name: "create_assignment",
      description: "Attribuer une nouvelle tâche ou un devoir à une classe.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "className", "dueDate"],
        properties: {
          title: { type: SchemaType.STRING, description: "Titre du devoir ou de la tâche (ex: 'Mathématiques Chapitre 5 Exercices', 'Devoir de français')." },
          className: { type: SchemaType.STRING, description: "Classe concernée (ex: '1A', '4B')." },
          subjectName: { type: SchemaType.STRING, description: "Matière concernée (ex: 'Mathématiques', 'Anglais', 'Français')." },
          teacherName: { type: SchemaType.STRING, description: "Nom de l'enseignant responsable (ex: 'Mme Hnia Selmi', 'M. Trabelsi'). Optionnel." },
          dueDate: {
            type: SchemaType.STRING,
            description: "Date d'échéance / date limite (ex: '2026-09-18', 'demain', 'dans 3 jours', 'vendredi prochain').",
          },
          description: { type: SchemaType.STRING, description: "Instructions détaillées ou consigne pour les élèves." },
          img: { type: SchemaType.STRING, description: "URL de la pièce jointe (photo de la fiche d'exercice, document numérisé ou PDF)." },
          startDate: { type: SchemaType.STRING, description: "Date de début (optionnel, par défaut aujourd'hui)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const subject = args.subjectName ? ` • 📖 <b>${args.subjectName}</b>` : "";
      const teacher = args.teacherName ? `\n👨‍🏫 Enseignant : <b>${args.teacherName}</b>` : "";
      const desc = args.description ? `\n📝 <i>"${args.description}"</i>` : "";
      const img = args.img ? "\n📎 <i>Pièce jointe attachée</i>" : "";
      return `❓ <b>Création de Tâche / Devoir</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📚 <b>${args.title}</b>\n👥 Classe : <code>${args.className}</code>${subject}${teacher}\n⏰ Date limite : <code>${args.dueDate}</code>${desc}${img}\n\nConfirmer l'attribution et l'envoi des notifications push aux familles ?`;
    },
    execute: createAssignmentTool,
  },

  get_assignment_details: {
    name: "get_assignment_details",
    description: "Consulter les détails complets d'une tâche (instructions, pièces jointes, taux de remise et élèves ayant rendu ou non leur travail).",
    requiresConfirmation: false,
    declaration: {
      name: "get_assignment_details",
      description: "Obtenir les détails complets et l'état des rendus d'une tâche ou devoir.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["assignmentIdOrTitle"],
        properties: {
          assignmentIdOrTitle: { type: SchemaType.STRING, description: "Identifiant ou titre de la tâche." },
        },
      },
    },
    execute: getAssignmentDetailsTool,
  },

  // ── COURSE RESOURCES SUITE (/list/resources) ─────────────────────────────
  add_resource: {
    name: "add_resource",
    description: "Publier une ressource pédagogique, un cours ou document pour une classe avec titre, classe, matière, description et lien de fichier obligatoire (url). OBLIGATOIRE: Nécessite un fichier (document PDF, Word, photo) préalablement envoyé et disponible via 'url'. Si l'administrateur n'a pas encore envoyé de fichier, NE PAS appeler cet outil ; lui demander d'abord d'envoyer le document et s'il a une description spécifique.",
    requiresConfirmation: true,
    declaration: {
      name: "add_resource",
      description: "Partager des documents de cours ou résumés pédagogiques avec les élèves d'une classe. Nécessite obligatoirement un document/fichier attaché.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "className", "url"],
        properties: {
          title: { type: SchemaType.STRING, description: "Titre de la ressource (ex: 'Résumé Chapitre 1 - Les Fonctions', 'Cours d'Anglais PDF')." },
          className: { type: SchemaType.STRING, description: "Classe concernée (ex: '1A', '4B')." },
          subjectName: { type: SchemaType.STRING, description: "Matière concernée (ex: 'Mathématiques', 'Anglais')." },
          teacherName: { type: SchemaType.STRING, description: "Nom de l'enseignant responsable (ex: 'Mme Hnia Selmi'). Optionnel." },
          url: { type: SchemaType.STRING, description: "Lien ou URL permanente du document / photo / PDF attaché (obligatoire)." },
          description: { type: SchemaType.STRING, description: "Description ou aperçu pédagogique du document partagé." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const subject = args.subjectName ? ` • 📖 <b>${args.subjectName}</b>` : "";
      const teacher = args.teacherName ? `\n👨‍🏫 Enseignant : <b>${args.teacherName}</b>` : "";
      const desc = args.description ? `\n📝 <i>"${args.description}"</i>` : "";
      const file = args.url ? "\n📎 <i>Fichier(s) attaché(s)</i>" : "";
      return `❓ <b>Publication de Ressource Pédagogique</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📚 <b>${args.title}</b>\n👥 Classe : <code>${args.className}</code>${subject}${teacher}${desc}${file}\n\nConfirmer la publication et l'envoi des notifications aux familles ?`;
    },
    execute: createResourceTool,
  },

  get_resources: {
    name: "get_resources",
    description: "Consulter la liste des ressources pédagogiques et documents de cours publiés pour une classe ou matière.",
    requiresConfirmation: false,
    declaration: {
      name: "get_resources",
      description: "Consulter les ressources pédagogiques et documents de cours partagés avec les élèves.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '1A'). Optionnel." },
          subjectName: { type: SchemaType.STRING, description: "Nom de la matière (ex: 'Mathématiques'). Optionnel." },
          limit: { type: SchemaType.NUMBER, description: "Nombre maximum de ressources à retourner." },
        },
      },
    },
    execute: getResourcesTool,
  },

  get_daily_caisse: {
    name: "get_daily_caisse",
    description: "Clôture de caisse journalière : total des encaissements reçus aujourd'hui (espèces/scolarités), total des dépenses réglées, solde net en caisse physique, et récapitulatif des absences.",
    requiresConfirmation: false,
    declaration: {
      name: "get_daily_caisse",
      description: "Générer le rapport de clôture de caisse journalière (recettes, dépenses, solde physique net du jour).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Date cible au format AAAA-MM-JJ (par défaut aujourd'hui)." },
        },
      },
    },
    execute: getDailyCaisseTool,
  },

  get_morning_briefing: {
    name: "get_morning_briefing",
    description: "Briefing exécutif du matin pour le directeur : séances du jour, absences de la veille à suivre, échéances et promesses de paiement du jour, annonces urgentes.",
    requiresConfirmation: false,
    declaration: {
      name: "get_morning_briefing",
      description: "Obtenir le briefing exécutif du matin de l'école (emploi du temps, relances, absences).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Date cible au format AAAA-MM-JJ (par défaut aujourd'hui)." },
        },
      },
    },
    execute: getMorningBriefingTool,
  },

  justify_attendance: {
    name: "justify_attendance",
    description: "Justifier ou motiver l'absence d'un élève avec un certificat médical, mot des parents ou raison valable. Met à jour le statut en 'JUSTIFIÉE/APPROUVÉE'.",
    requiresConfirmation: true,
    declaration: {
      name: "justify_attendance",
      description: "Justifier l'absence d'un élève avec motif et éventuel certificat médical joint.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "reason"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève (ex: 'Youssef Trabelsi')." },
          reason: { type: SchemaType.STRING, description: "Motif de la justification (ex: 'Certificat médical Dr. Ben Amor - 3 jours de repos')." },
          date: { type: SchemaType.STRING, description: "Date de l'absence au format AAAA-MM-JJ (par défaut aujourd'hui)." },
          certificateUrl: { type: SchemaType.STRING, description: "URL de l'image ou du document scanné du certificat médical (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const certBadge = args.certificateUrl ? "\n📎 <i>Certificat médical / justificatif joint</i>" : "";
      return `❓ <b>Confirmation : Justification d'Absence</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 Élève : <b>${args.studentNameOrId}</b>\n📋 Motif : <i>"${args.reason}"</i>${certBadge}\n\nValider la justification de cette absence ?`;
    },
    execute: justifyAttendanceTool,
  },

  update_parent_phone: {
    name: "update_parent_phone",
    description: "Mettre à jour le numéro de téléphone d'un parent d'élève sur SnapSchool.",
    requiresConfirmation: true,
    declaration: {
      name: "update_parent_phone",
      description: "Modifier le numéro de téléphone d'un parent d'élève.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrParentName", "newPhone"],
        properties: {
          studentNameOrParentName: { type: SchemaType.STRING, description: "Nom de l'élève ou nom du parent." },
          newPhone: { type: SchemaType.STRING, description: "Nouveau numéro de téléphone (8 chiffres, ex: '98123456')." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Confirmation : Changement de Téléphone</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 Cible : <b>${args.studentNameOrParentName}</b>\n📞 Nouveau numéro : <code>${args.newPhone}</code>\n\nConfirmer la mise à jour du contact ?`;
    },
    execute: updateParentPhoneTool,
  },

  void_expense: {
    name: "void_expense",
    description: "Annuler ou supprimer une dépense enregistrée par erreur dans le registre financier.",
    requiresConfirmation: true,
    declaration: {
      name: "void_expense",
      description: "Annuler une dépense enregistrée par erreur.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          expenseId: { type: SchemaType.NUMBER, description: "Identifiant numérique de la dépense si connu." },
          query: { type: SchemaType.STRING, description: "Titre ou enseigne de la dépense (ex: 'Monoprix', 'Facture STEG')." },
          amount: { type: SchemaType.NUMBER, description: "Montant de la dépense en Dinars Tunisiens (DT)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const q = args.query ? ` "${args.query}"` : "";
      const amt = args.amount ? ` de ${args.amount} DT` : "";
      return `❓ <b>Confirmation : Annulation de Dépense</b>\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ Vous êtes sur le point d'annuler et retirer la dépense${q}${amt} du registre financier.\n\nConfirmer l'annulation ?`;
    },
    execute: voidExpenseTool,
  },

  cancel_payment: {
    name: "cancel_payment",
    description: "Annuler ou rembourser un paiement de scolarité saisi par erreur pour un élève.",
    requiresConfirmation: true,
    declaration: {
      name: "cancel_payment",
      description: "Annuler un paiement de scolarité pour un élève et remettre le mois en impayé.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "month"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève." },
          month: { type: SchemaType.NUMBER, description: "Numéro du mois (1 à 12)." },
          year: { type: SchemaType.NUMBER, description: "Année (par défaut année courante)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Confirmation : Annulation de Règlement</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 Élève : <b>${args.studentNameOrId}</b>\n📅 Mois : <code>Mois ${args.month} ${args.year || ""}</code>\n\nRemettre ce mois en statut ❌ NON PAYÉ ?`;
    },
    execute: cancelPaymentTool,
  },

  update_student: {
    name: "update_student",
    description: "Mettre à jour les informations d'un élève : transfert de classe, tarif mensuel personnalisé ou téléphone.",
    requiresConfirmation: true,
    declaration: {
      name: "update_student",
      description: "Modifier la classe, le tarif ou les coordonnées d'un élève.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève." },
          newClassName: { type: SchemaType.STRING, description: "Nouvelle classe d'affectation (ex: '2B')." },
          customTuition: { type: SchemaType.NUMBER, description: "Nouveau tarif mensuel personnalisé en DT (ex: 420)." },
          phone: { type: SchemaType.STRING, description: "Nouveau téléphone personnel de l'élève." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const cls = args.newClassName ? `\n🏫 Nouvelle classe : <code>${args.newClassName}</code>` : "";
      const tui = args.customTuition ? `\n💰 Nouveau tarif : <code>${args.customTuition} DT/mois</code>` : "";
      const ph = args.phone ? `\n📞 Tél : <code>${args.phone}</code>` : "";
      return `❓ <b>Confirmation : Modification Fiche Élève</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 Élève : <b>${args.studentNameOrId}</b>${cls}${tui}${ph}\n\nAppliquer ces changements immédiatement ?`;
    },
    execute: updateStudentTool,
  },

  // ── SUITE 8: SCHOOL KNOWLEDGE & ADMIN TEACHING ────────────────────────────
  teach_hnia: {
    name: "teach_hnia",
    description: "Mémoriser et enregistrer une nouvelle consigne, fait, règle de fonctionnement, contact utile (chauffeur bus, etc.), tarif ou correction pour l'école.",
    requiresConfirmation: false,
    declaration: {
      name: "teach_hnia",
      description: "Mémoriser une consigne, règle, contact ou fait enseigné par l'administrateur pour son école.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["instruction"],
        properties: {
          instruction: {
            type: SchemaType.STRING,
            description: "La consigne, fait ou règle exacte à mémoriser (ex: 'Le chauffeur du bus 2 est Am Hedi 98123456', 'La cantine est à 130 DT').",
          },
          category: {
            type: SchemaType.STRING,
            description: "Catégorie facultative : 'GENERAL', 'FINANCE', 'TRANSPORT', 'RULES', 'TIMETABLE', 'STAFF', 'PEDAGOGY'.",
          },
        },
      },
    },
    execute: teachHniaTool,
  },

  get_hnia_teachings: {
    name: "get_hnia_teachings",
    description: "Consulter la liste de toutes les consignes, règles et notes spécifiques que l'administrateur a enseignées à Hnia.",
    requiresConfirmation: false,
    declaration: {
      name: "get_hnia_teachings",
      description: "Consulter les connaissances et règles de l'école enseignées à Hnia.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          category: {
            type: SchemaType.STRING,
            description: "Filtrer par catégorie ('GENERAL', 'FINANCE', 'TRANSPORT', 'RULES', 'TIMETABLE', 'STAFF', 'PEDAGOGY').",
          },
          query: {
            type: SchemaType.STRING,
            description: "Mots-clés de recherche dans les consignes.",
          },
        },
      },
    },
    execute: getHniaTeachingsTool,
  },

  forget_hnia_teaching: {
    name: "forget_hnia_teaching",
    description: "Oublier ou supprimer une consigne ou règle précédemment apprise par Hnia.",
    requiresConfirmation: false,
    declaration: {
      name: "forget_hnia_teaching",
      description: "Supprimer ou désactiver une consigne apprise par Hnia selon des mots-clés ou un identifiant.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: {
            type: SchemaType.STRING,
            description: "Mots-clés désignant la règle à oublier (ex: 'bus 2', 'cantine', ou 'tout').",
          },
          teachingId: {
            type: SchemaType.STRING,
            description: "Identifiant exact de la consigne (facultatif).",
          },
        },
      },
    },
    execute: forgetHniaTeachingTool,
  },

  // ── SUITE 9: PERSONAL REMINDERS & ALARMS ─────────────────────────────────
  schedule_reminder: {
    name: "schedule_reminder",
    description: "Programmer un rappel ou une alarme personnelle pour l'administrateur avec notification Telegram automatique (ex: 'fakarni baad 2 minutes bech ntfa9ed sallet', 'rappelle-moi dans 15 minutes', 'fakarni m3a 14h').",
    requiresConfirmation: false,
    declaration: {
      name: "schedule_reminder",
      description: "Programmer un rappel ou une alarme qui notifiera automatiquement l'administrateur sur Telegram.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["subject"],
        properties: {
          subject: {
            type: SchemaType.STRING,
            description: "Le sujet de la tâche ou de l'alerte à rappeler (ex: 'Vérifier la salle de cours', 'Appeler M. Trabelsi').",
          },
          delayMinutes: {
            type: SchemaType.NUMBER,
            description: "Délai en minutes avant l'alerte (ex: 2 pour 2 minutes, 15 pour 15 minutes, 60 pour 1 heure).",
          },
          targetTime: {
            type: SchemaType.STRING,
            description: "Heure cible exacte si précisée (ex: '14:30', '16:00', '08:15').",
          },
        },
      },
    },
    execute: scheduleReminderTool,
  },

  get_reminders: {
    name: "get_reminders",
    description: "Consulter la liste des rappels programmés et alarmes en attente.",
    requiresConfirmation: false,
    declaration: {
      name: "get_reminders",
      description: "Lister les rappels prévus pour l'administrateur.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: {
            type: SchemaType.NUMBER,
            description: "Nombre maximum de rappels à afficher (défaut 10).",
          },
        },
      },
    },
    execute: getRemindersTool,
  },

  cancel_reminder: {
    name: "cancel_reminder",
    description: "Annuler un rappel programmé existant.",
    requiresConfirmation: false,
    declaration: {
      name: "cancel_reminder",
      description: "Annuler un rappel par mot-clé ou identifiant.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: {
            type: SchemaType.STRING,
            description: "Mot-clé du sujet du rappel à annuler (ex: 'salle', 'tous').",
          },
          reminderId: {
            type: SchemaType.STRING,
            description: "Identifiant exact du rappel.",
          },
        },
      },
    },
    execute: cancelReminderTool,
  },

  // ── OFFICIAL PDF DOCUMENTS & RECEIPTS SUITE ───────────────────────────────
  get_payment_receipt: {
    name: "get_payment_receipt",
    description: "Générer et envoyer directement en pièce jointe PDF dans Telegram le reçu officiel de paiement de scolarité pour un élève (avec cachet officiel de l'école, N° de quittance et détail du règlement). À utiliser dès que l'administrateur demande le reçu ('donne-moi le reçu de Wiem', 'reçu de scolarité', 'quittance de paiement', 'reçu pdf').",
    requiresConfirmation: false,
    declaration: {
      name: "get_payment_receipt",
      description: "Générer et envoyer le reçu officiel de paiement de scolarité en document PDF dans Telegram.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom, prénom ou ID de l'élève concerné." },
          month: { type: SchemaType.NUMBER, description: "Numéro du mois (1 à 12, optionnel. Par défaut: mois en cours)." },
          year: { type: SchemaType.NUMBER, description: "Année (optionnel. Par défaut: année en cours)." },
        },
        required: ["studentNameOrId"],
      },
    },
    execute: getPaymentReceiptTool,
  },

  get_salary_payslip: {
    name: "get_salary_payslip",
    description: "Générer et envoyer directement en pièce jointe PDF dans Telegram le bulletin de paie (fiche de salaire) officiel pour un enseignant ou membre du personnel (avec détail salaire de base, retenues, avances, net versé et cachet officiel). À utiliser quand l'administrateur demande le bulletin ou la fiche de paie ('fiche de paie de Mohamed', 'bulletin de salaire enseignant', 'fiche de paie pdf').",
    requiresConfirmation: false,
    declaration: {
      name: "get_salary_payslip",
      description: "Générer et envoyer la fiche de paie officielle en document PDF dans Telegram.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          nameOrId: { type: SchemaType.STRING, description: "Nom, prénom ou ID de l'enseignant ou du personnel." },
          userType: { type: SchemaType.STRING, description: "'TEACHER' pour enseignant (par défaut), ou 'STAFF' pour personnel." },
          month: { type: SchemaType.NUMBER, description: "Numéro du mois (1 à 12, optionnel. Par défaut: mois en cours)." },
          year: { type: SchemaType.NUMBER, description: "Année (optionnel. Par défaut: année en cours)." },
        },
        required: ["nameOrId"],
      },
    },
    execute: getSalaryPayslipTool,
  },
};

/**
 * Returns array of Gemini Function Declarations for model initialization
 */
export function getGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return Object.values(TOOLS).map((t) => t.declaration);
}
