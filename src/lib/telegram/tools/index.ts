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
} from "./readTools";
import prisma from "@/lib/prisma";
import {
  recordPaymentTool,
  addExpenseTool,
  postAnnouncementTool,
  calculateStudentPaymentAllocation,
} from "./writeTools";
import {
  getStudentProfileTool,
  getParentsTool,
  getClassesTool,
  createStudentTool,
  createClassTool,
  assignStudentToClassTool,
} from "./academicTools";

// Suite 2: Teachers & Staff
import {
  getStaffTool,
  createTeacherTool,
  createStaffTool,
  payTeacherSalaryTool,
  payStaffSalaryTool,
} from "./teacherStaffTools";

// Suite 3: Attendance
import {
  getStudentAttendanceHistoryTool,
  markAttendanceTool,
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
} from "./financeTools";

// Suite 6: Timetable & Substitution
import {
  getClassTimetableTool,
  findAvailableTeachersTool,
  addTimetableSlotTool,
} from "./timetableTools";

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
    description: "Consulter la fiche complète 360° d'un élève (coordonnées parents, scolarité, absences, dernières notes).",
    requiresConfirmation: false,
    declaration: {
      name: "get_student_profile",
      description: "Obtenir la fiche complète 360° d'un élève avec scolarité, coordonnées parentales, présences et notes.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève." },
        },
      },
    },
    execute: getStudentProfileTool,
  },

  get_parents: {
    name: "get_parents",
    description: "Rechercher des parents d'élèves par nom ou téléphone et voir leurs enfants inscrits.",
    requiresConfirmation: false,
    declaration: {
      name: "get_parents",
      description: "Rechercher des parents d'élèves par nom ou téléphone.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { type: SchemaType.STRING, description: "Nom, prénom ou téléphone du parent." },
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
      return `❓ **Confirmation requise :**\nSouhaitez-vous inscrire l'élève **${args.name} ${args.surname}** en classe de **${args.className}**${
        args.parentPhone ? ` (Parent : ${args.parentPhone})` : ""
      } ?`;
    },
    execute: createStudentTool,
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
      return `❓ **Confirmation requise :**\nSouhaitez-vous créer la classe **"${args.name}"** (Capacité : ${args.capacity || 25} élèves) ?`;
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
      return `❓ **Confirmation requise :**\nSouhaitez-vous affecter l'élève **${args.studentNameOrId}** à la classe **${args.className}** ?`;
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
      return `❓ **Confirmation requise :**\nSouhaitez-vous enregistrer l'enseignant(e) **${args.name} ${args.surname}** (Tél : ${args.phone}) ?`;
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
      return `❓ **Confirmation requise :**\nSouhaitez-vous ajouter le membre du personnel **${args.name} ${args.surname}**${
        args.salary ? ` (Salaire : ${args.salary} DT)` : ""
      } ?`;
    },
    execute: createStaffTool,
  },

  pay_teacher_salary: {
    name: "pay_teacher_salary",
    description: "Enregistrer un paiement de salaire ou une avance pour un enseignant avec déduction pour heures manquées.",
    requiresConfirmation: true,
    declaration: {
      name: "pay_teacher_salary",
      description: "Enregistrer un salaire ou une avance sur salaire pour un enseignant.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["teacherNameOrId", "amount"],
        properties: {
          teacherNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'enseignant." },
          amount: { type: SchemaType.NUMBER, description: "Montant payé en Dinars Tunisiens (DT)." },
          month: { type: SchemaType.NUMBER, description: "Mois concerné (1 à 12)." },
          year: { type: SchemaType.NUMBER, description: "Année (ex: 2026)." },
          isAdvance: { type: SchemaType.BOOLEAN, description: "Vrai s'il s'agit d'une avance sur salaire." },
          missedHours: { type: SchemaType.NUMBER, description: "Nombre d'heures manquées à déduire." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const type = args.isAdvance ? "l'avance sur salaire" : "le salaire";
      const deductionNote = args.missedHours ? ` (déduction appliquée pour ${args.missedHours}h d'absence)` : "";
      const monthStr = args.month ? ` pour le mois ${args.month}` : "";
      return `❓ <b>Confirmation requise :</b>\nSouhaitez-vous enregistrer <b>${type} de ${args.amount} DT</b> pour l'enseignant(e) <b>${args.teacherNameOrId}</b>${monthStr}${deductionNote} ?`;
    },
    execute: payTeacherSalaryTool,
  },

  pay_staff_salary: {
    name: "pay_staff_salary",
    description: "Enregistrer un paiement de salaire ou une avance pour un membre du staff.",
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
          isAdvance: { type: SchemaType.BOOLEAN, description: "Vrai s'il s'agit d'une avance." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const type = args.isAdvance ? "l'avance" : "le salaire";
      return `❓ **Confirmation requise :**\nSouhaitez-vous enregistrer **${type} de ${args.amount} DT** pour **${args.staffNameOrId}** ?`;
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
    description: "Consulter l'historique complet des absences et retards d'un élève sur les 30 derniers jours.",
    requiresConfirmation: false,
    declaration: {
      name: "get_student_attendance_history",
      description: "Consulter l'historique des absences d'un élève.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'élève." },
          daysCount: { type: SchemaType.NUMBER, description: "Nombre de jours d'historique (défaut : 30)." },
        },
      },
    },
    execute: getStudentAttendanceHistoryTool,
  },

  mark_attendance: {
    name: "mark_attendance",
    description: "Pointer un élève comme ABSENT, EN RETARD ou PRÉSENT avec alerte automatique aux parents.",
    requiresConfirmation: true,
    declaration: {
      name: "mark_attendance",
      description: "Enregistrer une absence ou un retard pour un élève.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "status"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'élève." },
          status: { type: SchemaType.STRING, description: "'ABSENT', 'LATE', ou 'PRESENT'." },
          date: { type: SchemaType.STRING, description: "Date au format AAAA-MM-JJ si différente d'aujourd'hui." },
          note: { type: SchemaType.STRING, description: "Remarque ou motif (ex: 'Maladie', 'Retard transport')." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const statusLabels: Record<string, string> = {
        ABSENT: "ABSENT",
        LATE: "EN RETARD",
        PRESENT: "PRÉSENT",
      };
      return `❓ **Confirmation requise :**\nSouhaitez-vous marquer l'élève **${args.studentNameOrId}** comme **${statusLabels[args.status] || args.status}** ?`;
    },
    execute: markAttendanceTool,
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
      return `❓ **Confirmation requise :**\nSouhaitez-vous enregistrer la note de **${args.score} / 20** en **${args.subjectName}** pour l'élève **${args.studentNameOrId}** (Trimestre ${args.term || 1}) ?`;
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
      return `❓ **Confirmation requise :**\nSouhaitez-vous planifier l'examen **"${args.title}"** (${args.subjectName}) pour la classe **${args.className}** le **${args.date}** ?`;
    },
    execute: scheduleExamTool,
  },

  // ── FINANCE SUITE ─────────────────────────────────────────────────────────
  get_payments: {
    name: "get_payments",
    description: "Consulter les paiements de scolarité, impayés ou paiements en retard.",
    requiresConfirmation: false,
    declaration: {
      name: "get_payments",
      description: "Vérifier le statut des frais de scolarité pour un mois/année.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          month: { type: SchemaType.NUMBER, description: "Numéro du mois (1 à 12)." },
          year: { type: SchemaType.NUMBER, description: "Année (ex: 2026)." },
          status: { type: SchemaType.STRING, description: "'PENDING', 'PAID', ou 'PARTIAL'." },
          studentName: { type: SchemaType.STRING, description: "Filtrer par nom d'élève." },
        },
      },
    },
    execute: getPaymentsTool,
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
      const student = await prisma.student.findFirst({
        where: {
          schoolId: context.schoolId,
          OR: [
            { id: query },
            { name: { contains: query, mode: "insensitive" } },
            { surname: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { class: true },
      });

      if (!student) {
        return `❓ <b>Confirmation requise :</b>\nSouhaitez-vous enregistrer le versement de <code>${args.amount} DT</code> pour <b>${args.studentNameOrId}</b> ?`;
      }

      const allocation = await calculateStudentPaymentAllocation(
        student.id,
        args.amount,
        context.schoolId,
        args.month,
        args.year
      );

      if (!allocation || allocation.paymentsToProcess.length === 0) {
        return `❓ <b>Confirmation requise :</b>\nSouhaitez-vous enregistrer le versement de <code>${args.amount} DT</code> pour <b>${student.name} ${student.surname}</b> ?`;
      }

      const lines = allocation.paymentsToProcess.map((p) => {
        const badge = p.isPartial
          ? `PARTIEL ⚠️ (Versé: <code>${p.amount} DT</code>, Reste dû: <code>${p.gap} DT</code>)`
          : `SOLDÉ ✅ (<code>${p.amount} DT</code>)`;
        return `• <b>${p.monthYear}</b> : ${badge}`;
      });

      return `❓ <b>Confirmation requise :</b>
Souhaitez-vous enregistrer le versement de <code>${args.amount} DT</code> pour <b>${student.name} ${student.surname}</b> (Classe : <code>${student.class?.name || "Sans classe"}</code>) ?

📋 <b>Ventilation automatique calculée :</b>
${lines.join("\n")}`;
    },
    execute: recordPaymentTool,
  },

  add_expense: {
    name: "add_expense",
    description: "Enregistrer une dépense opérationnelle (facture STEG, fournitures, entretien, etc.).",
    requiresConfirmation: true,
    declaration: {
      name: "add_expense",
      description: "Enregistrer une dépense payée par l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "amount"],
        properties: {
          title: { type: SchemaType.STRING, description: "Description de la dépense." },
          amount: { type: SchemaType.NUMBER, description: "Montant en DT." },
          category: { type: SchemaType.STRING, description: "Catégorie (ex: 'Factures', 'Fournitures', 'Maintenance')." },
          date: { type: SchemaType.STRING, description: "Date au format AAAA-MM-JJ." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ **Confirmation requise :**\nSouhaitez-vous enregistrer la dépense **"${args.title}"** de **${args.amount} DT** (Catégorie : ${
        args.category || "Général"
      }) ?`;
    },
    execute: addExpenseTool,
  },

  send_payment_reminders: {
    name: "send_payment_reminders",
    description: "Déclencher l'envoi de rappels de paiement (push et notifications) aux parents des élèves ayant des impayés.",
    requiresConfirmation: true,
    declaration: {
      name: "send_payment_reminders",
      description: "Envoyer des notifications de rappel de paiement aux familles avec scolarité impayée.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          force: { type: SchemaType.BOOLEAN, description: "Forcer l'envoi même si un rappel a été envoyé récemment." },
        },
      },
    },
    formatConfirmationMessage: () => {
      return `❓ **Confirmation requise :**\nSouhaitez-vous envoyer un **rappel de paiement par notification** à toutes les familles ayant des impayés ce mois-ci ?`;
    },
    execute: sendPaymentRemindersTool,
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
      return `❓ **Confirmation requise :**\nSouhaitez-vous ajouter la séance de **${args.subjectName}** pour **${args.className}** avec **${args.teacherName}** le **${args.day}** de ${args.startTime} à ${args.endTime} ?`;
    },
    execute: addTimetableSlotTool,
  },

  // ── COMMUNICATION SUITE ───────────────────────────────────────────────────
  post_announcement: {
    name: "post_announcement",
    description: "Publier une annonce officielle pour toute l'école ou une classe spécifique.",
    requiresConfirmation: true,
    declaration: {
      name: "post_announcement",
      description: "Publier une annonce / avis visible par les familles.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["title", "message"],
        properties: {
          title: { type: SchemaType.STRING, description: "Titre de l'annonce." },
          message: { type: SchemaType.STRING, description: "Contenu détaillé." },
          className: { type: SchemaType.STRING, description: "Classe ciblée si réservée à une classe." },
          important: { type: SchemaType.BOOLEAN, description: "Si annonce urgente." },
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
