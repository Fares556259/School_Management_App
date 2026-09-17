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
  listUnassignedStudentsTool,
  linkStudentToParentTool,
  updateParentPhoneTool,
  updateStudentTool,
  deleteStudentTool,
  updateParentTool,
  deleteParentTool,
  updatePersonPhotoTool,
  updateClassTool,
  assignTeacherToClassTool,
  removeTeacherFromClassTool,
} from "./academicTools";

import {
  getStaffTool,
  createTeacherTool,
  updateTeacherTool,
  deleteTeacherTool,
  createStaffTool,
  updateStaffTool,
  deleteStaffTool,
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
  recordClassGradesTool,
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
  updateIncomeTool,
  deleteIncomeTool,
  getExpensesTool,
  updateExpenseTool,
  getDailyCaisseTool,
  voidExpenseTool,
  cancelPaymentTool,
  getAuditLogTool,
  addAuditEntryTool,
} from "./financeTools";

// Suite 6: Timetable & Substitution
import {
  getClassTimetableTool,
  getTeacherTimetableTool,
  getTimetableConflictsTool,
  findAvailableTeachersTool,
  addTimetableSlotTool,
  rescheduleTimetableSlotTool,
  swapTimetableSlotsTool,
  updateTimetableSlotTool,
  deleteTimetableSlotTool,
  suggestBestTimetableSlotTool,
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
  getDailyCashPdfTool,
} from "./documentTools";

// Suite 11: External School / Government Portals (Browser Automation)
import {
  searchExternalStudentTool,
  getExternalStudentTool,
  listExternalDocumentsTool,
  downloadExternalDocumentTool,
} from "./externalPortalTools";

// Suite 12: System, Profile & School Settings (/profile, /settings)
import {
  getAdminProfileTool,
  updateAdminProfileTool,
  getSchoolSettingsTool,
  updateSchoolSettingsTool,
  updateLevelTuitionFeeTool,
} from "./systemTools";


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

  update_class: {
    name: "update_class",
    description: "Modifier les paramètres d'une classe existante : renommer la classe, modifier sa capacité maximale, affecter ou changer son professeur principal / titulaire (supervisor), ou modifier son niveau.",
    requiresConfirmation: true,
    declaration: {
      name: "update_class",
      description: "Modifier une classe existante (renommer, capacité, professeur principal, niveau).",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom actuel de la classe à modifier (ex: '1A', '8ème B')." },
          newName: { type: SchemaType.STRING, description: "Nouveau nom souhaité pour la classe (ex: '1A-Excellence')." },
          capacity: { type: SchemaType.NUMBER, description: "Nouvelle capacité maximale d'élèves (ex: 30)." },
          supervisorNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'enseignant à désigner comme professeur principal/titulaire, ou 'aucun' pour retirer le titulaire actuel." },
          levelNumber: { type: SchemaType.NUMBER, description: "Numéro de niveau académique (ex: 1, 2, 8)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const parts: string[] = [];
      if (args.newName) parts.push(`Nouveau nom : <code>${args.newName}</code>`);
      if (args.capacity) parts.push(`Capacité : <code>${args.capacity} élèves</code>`);
      if (args.supervisorNameOrId) parts.push(`Professeur principal : <b>${args.supervisorNameOrId}</b>`);
      if (args.levelNumber) parts.push(`Niveau : <code>${args.levelNumber}</code>`);
      return `❓ <b>Modification de la Classe <code>${args.className}</code></b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous appliquer ces changements ?\n${parts.length > 0 ? parts.map((p) => `• ${p}`).join("\n") : "• Mise à jour de la classe"}`;
    },
    execute: updateClassTool,
  },

  assign_teacher_to_class: {
    name: "assign_teacher_to_class",
    description: "Affecter un nouvel enseignant à une classe en tant que professeur principal (titulaire) ou pour enseigner une matière spécifique (cours/séance).",
    requiresConfirmation: true,
    declaration: {
      name: "assign_teacher_to_class",
      description: "Affecter un enseignant à une classe (comme professeur principal ou pour une matière).",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["teacherNameOrId", "className"],
        properties: {
          teacherNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'enseignant." },
          className: { type: SchemaType.STRING, description: "Nom de la classe cible (ex: '1A', '2B')." },
          role: { type: SchemaType.STRING, description: "'supervisor' pour professeur principal/titulaire, ou 'subject_teacher' pour professeur de matière." },
          subjectName: { type: SchemaType.STRING, description: "Nom de la matière enseignée dans cette classe (ex: 'Mathématiques', 'Français', 'Histoire')." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const roleText = args.subjectName
        ? `professeur de <b>${args.subjectName}</b>`
        : `professeur principal / titulaire`;
      return `❓ <b>Affectation Enseignant</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous affecter <b>${args.teacherNameOrId}</b> comme ${roleText} à la classe <code>${args.className}</code> ?`;
    },
    execute: assignTeacherToClassTool,
  },

  remove_teacher_from_class: {
    name: "remove_teacher_from_class",
    description: "Retirer un enseignant d'une classe (retirer la fonction de professeur principal ou supprimer ses séances de cours pour une matière).",
    requiresConfirmation: true,
    declaration: {
      name: "remove_teacher_from_class",
      description: "Retirer un enseignant d'une classe (titulaire ou cours).",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["teacherNameOrId", "className"],
        properties: {
          teacherNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'enseignant à retirer." },
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '1A')." },
          subjectName: { type: SchemaType.STRING, description: "Matière spécifique à retirer (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const detail = args.subjectName ? `pour la matière <b>${args.subjectName}</b>` : `(titulaire et cours)`;
      return `❓ <b>Retrait d'un Enseignant</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous retirer <b>${args.teacherNameOrId}</b> de la classe <code>${args.className}</code> ${detail} ?`;
    },
    execute: removeTeacherFromClassTool,
  },

  assign_student_to_class: {
    name: "assign_student_to_class",
    description: "Déplacer ou affecter un ou plusieurs élèves dans une classe spécifique.",
    requiresConfirmation: true,
    declaration: {
      name: "assign_student_to_class",
      description: "Affecter ou déplacer un ou plusieurs élèves vers une classe de destination.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou ID d'un élève (ou plusieurs séparés par des virgules)." },
          studentNames: {
            type: SchemaType.ARRAY,
            description: "Liste des noms ou IDs des élèves à affecter en masse à la classe.",
            items: { type: SchemaType.STRING },
          },
          className: { type: SchemaType.STRING, description: "Nouvelle classe de destination (ex: 8ème B, 7A, etc.)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const target = Array.isArray(args.studentNames) && args.studentNames.length > 0
        ? `les <b>${args.studentNames.length}</b> élève(s) (<code>${args.studentNames.join(", ")}</code>)`
        : `<b>${args.studentNameOrId}</b>`;
      return `❓ <b>Affectation de Classe</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous affecter ${target} à la classe <code>${args.className}</code> ?`;
    },
    execute: assignStudentToClassTool,
  },

  list_unassigned_students: {
    name: "list_unassigned_students",
    description: "Lister les élèves qui n'ont pas encore de classe assignée (non classés) ou qui n'ont pas de parent lié.",
    requiresConfirmation: false,
    declaration: {
      name: "list_unassigned_students",
      description: "Lister les élèves non classés (sans classe) ou sans parent.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          filter: {
            type: SchemaType.STRING,
            description: "Filtre: 'no_class' (sans classe), 'no_parent' (sans parent), ou 'both' (les deux). Par défaut 'no_class'.",
          },
          limit: { type: SchemaType.NUMBER, description: "Nombre maximum d'élèves à retourner (défaut: 50)." },
        },
      },
    },
    execute: listUnassignedStudentsTool,
  },

  link_student_to_parent: {
    name: "link_student_to_parent",
    description: "Associer un élève existant à un parent existant (par nom ou numéro de téléphone).",
    requiresConfirmation: true,
    declaration: {
      name: "link_student_to_parent",
      description: "Associer un élève à un parent existant via son nom ou numéro de téléphone.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "parentPhoneOrName"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou ID de l'élève à lier." },
          parentPhoneOrName: { type: SchemaType.STRING, description: "Nom ou numéro de téléphone du parent." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Liaison Élève - Parent</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous associer l'élève <b>${args.studentNameOrId}</b> au parent <code>${args.parentPhoneOrName}</code> ?`;
    },
    execute: linkStudentToParentTool,
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
            description: "Liste des matières enseignées (ex: ['Mathématiques', 'Physique']).",
          },
          classNames: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Liste des classes assignées à l'enseignant (ex: ['1A', '2B', '3C']).",
          },
          hourlyRate: { type: SchemaType.NUMBER, description: "Taux horaire en DT (défaut : 25 DT)." },
          hoursPerMonth: { type: SchemaType.NUMBER, description: "Volume horaire mensuel prévu." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const parts = [`📞 Téléphone : <code>${args.phone}</code>`];
      if (args.subjectNames && args.subjectNames.length > 0) parts.push(`📚 Matières : <b>${args.subjectNames.join(", ")}</b>`);
      if (args.classNames && args.classNames.length > 0) parts.push(`🏫 Classes : <b>${args.classNames.join(", ")}</b>`);
      if (args.hourlyRate) parts.push(`💰 Taux horaire : <code>${args.hourlyRate} DT/h</code>`);
      return `❓ <b>Nouveau Professeur</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous enregistrer <b>${args.name} ${args.surname}</b> ?\n${parts.map((p) => `• ${p}`).join("\n")}`;
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

  record_class_grades: {
    name: "record_class_grades",
    description: "Enregistrer ou mettre à jour en masse les notes d'une classe entière pour une matière et un trimestre (depuis la saisie directe de l'admin ou suite à la numérisation OCR d'une feuille de notes).",
    requiresConfirmation: true,
    declaration: {
      name: "record_class_grades",
      description: "Enregistrer en masse les notes de toute une classe pour une matière et un trimestre.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className", "subjectName", "grades"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '1A', '3B')." },
          subjectName: { type: SchemaType.STRING, description: "Nom de la matière (ex: 'Mathématiques', 'Français')." },
          term: { type: SchemaType.NUMBER, description: "Trimestre (1, 2 ou 3, défaut: 1)." },
          grades: {
            type: SchemaType.ARRAY,
            description: "Liste des notes par élève : [{ studentName: 'Nom Prénom', score: 16.5 }].",
            items: {
              type: SchemaType.OBJECT,
              required: ["studentName", "score"],
              properties: {
                studentName: { type: SchemaType.STRING, description: "Nom complet de l'élève." },
                score: { type: SchemaType.NUMBER, description: "Note sur 20 (entre 0 et 20)." },
              },
            },
          },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const count = Array.isArray(args.grades) ? args.grades.length : 0;
      const sample = (args.grades || [])
        .slice(0, 5)
        .map((g: any) => `• ${g.studentName} : <b>${g.score} / 20</b>`)
        .join("\n");
      const more = count > 5 ? `\n<i>... et ${count - 5} autre(s) élève(s)</i>` : "";
      return `❓ <b>Saisie Groupée de Notes (${count} élèves)</b>\n━━━━━━━━━━━━━━━━━━━━━━\nClasse : <code>${args.className}</code>\nMatière : <b>${args.subjectName}</b> (Trimestre <code>${args.term || 1}</code>)\n\n${sample}${more}\n\nSouhaitez-vous confirmer l'enregistrement de ces notes dans les bulletins ?`;
    },
    execute: recordClassGradesTool,
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
          className: { type: SchemaType.STRING, description: "Classe de l'élève si mentionnée (ex: '1A', '6B', '3ème A')." },
          month: { type: SchemaType.NUMBER, description: "Mois ciblé (1 à 12, optionnel)." },
          year: { type: SchemaType.NUMBER, description: "Année (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: async (args, context) => {
      const q = (args.studentNameOrId || "").trim();
      const student = await resolveStudentByName(context.schoolId, q, args.className);

      const now = new Date();
      const targetMonth = args.month || now.getMonth() + 1;
      const targetYear = args.year || now.getFullYear();
      const monthLabel = formatMonthFrench(`${MONTHS[targetMonth - 1]} ${targetYear}`);

      const studentDisplay = student ? `${student.name} ${student.surname} (Classe : ${student.class?.name || "N/A"})` : args.studentNameOrId;
      const amountStr = args.amount ? `<code>${args.amount} DT</code>` : "<b>la totalité du reliquat restant</b>";

      return `❓ <b>Recouvrement de Reliquat</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 Élève : <b>${studentDisplay}</b>
📅 Mois ciblé : <code>${monthLabel}</code>
💰 Montant à encaisser : ${amountStr}

Confirmer l'encaissement du reliquat pour cet élève ?`;
    },
    execute: recoverPartialPaymentTool,
  },

  schedule_recovery_date: {
    name: "schedule_recovery_date",
    description: "Fixer la date limite de paiement promise pour un dossier partiel.",
    requiresConfirmation: true,
    declaration: {
      name: "schedule_recovery_date",
      description: "Fixer la date limite de paiement promise pour un dossier partiel.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId", "date"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève." },
          className: { type: SchemaType.STRING, description: "Classe de l'élève si mentionnée (ex: '1A')." },
          date: { type: SchemaType.STRING, description: "Date promise au format AAAA-MM-JJ (ex: '2026-09-25')." },
          month: { type: SchemaType.NUMBER, description: "Mois concerné (optionnel)." },
          year: { type: SchemaType.NUMBER, description: "Année concernée (optionnel)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const classStr = args.className ? ` (${args.className})` : "";
      return `❓ <b>Planification d'Échéance</b>\n━━━━━━━━━━━━━━━━━━━━━━\nFixer la date limite de recouvrement pour <b>${args.studentNameOrId}</b>${classStr} au <code>${args.date}</code> ?`;
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
          month: { type: SchemaType.NUMBER, description: "Mois (1 à 12, optionnel)." },
          year: { type: SchemaType.NUMBER, description: "Année (optionnel)." },
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
          className: { type: SchemaType.STRING, description: "Classe de l'élève si mentionnée (ex: '1A', '6B', '3ème A') pour cibler directement le bon élève." },
          month: { type: SchemaType.NUMBER, description: "Mois de début ou mois ciblé (1 à 12, optionnel : commence au 1er impayé par défaut)." },
          year: { type: SchemaType.NUMBER, description: "Année (ex: 2026, optionnel)." },
        },
      },
    },
    formatConfirmationMessage: async (args, context) => {
      const query = (args.studentNameOrId || "").trim();
      const student = await resolveStudentByName(context.schoolId, query, args.className);

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

  get_teacher_timetable: {
    name: "get_teacher_timetable",
    description: "Consulter l'emploi du temps d'un enseignant sur toute la semaine ou pour un jour précis.",
    requiresConfirmation: false,
    declaration: {
      name: "get_teacher_timetable",
      description: "Consulter les cours programmés d'un enseignant dans l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["teacherName"],
        properties: {
          teacherName: { type: SchemaType.STRING, description: "Nom ou prénom de l'enseignant." },
          day: { type: SchemaType.STRING, description: "Jour spécifique optionnel (ex: 'lundi', 'mardi')." },
        },
      },
    },
    execute: getTeacherTimetableTool,
  },

  get_timetable_conflicts: {
    name: "get_timetable_conflicts",
    description: "Auditer l'emploi du temps de l'école pour détecter les doublons et conflits horaires (enseignants en double séance, salles occupées deux fois, ou classes superposées).",
    requiresConfirmation: false,
    declaration: {
      name: "get_timetable_conflicts",
      description: "Vérifier la présence de conflits ou de superpositions dans l'emploi du temps de l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          className: { type: SchemaType.STRING, description: "Classe spécifique optionnelle à vérifier." },
        },
      },
    },
    execute: getTimetableConflictsTool,
  },

  suggest_best_timetable_slot: {
    name: "suggest_best_timetable_slot",
    description: "Assistant intelligent de planification : analyse l'emploi du temps de la classe, les disponibilités de l'enseignant dans toute l'école, et les contraintes exprimées par l'administrateur pour recommander les 3 meilleurs créneaux sans conflit.",
    requiresConfirmation: false,
    declaration: {
      name: "suggest_best_timetable_slot",
      description: "Recommander les meilleurs créneaux sans conflit selon les contraintes de l'administrateur.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className", "subjectName"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe (ex: '1A', '8ème B')." },
          subjectName: { type: SchemaType.STRING, description: "Matière à programmer (ex: 'Mathématiques', 'Anglais')." },
          teacherName: { type: SchemaType.STRING, description: "Nom de l'enseignant pressenti (optionnel)." },
          durationMinutes: { type: SchemaType.NUMBER, description: "Durée en minutes (ex: 60, 90, 120 - défaut: 120)." },
          constraints: { type: SchemaType.STRING, description: "Contraintes en langage naturel (ex: 'pas le mercredi matin', 'uniquement le matin', 'éviter vendredi après-midi', 'le prof n'est pas dispo jeudi')." },
          preferredDay: { type: SchemaType.STRING, description: "Jour préféré optionnel (ex: 'mardi')." },
        },
      },
    },
    execute: suggestBestTimetableSlotTool,
  },

  reschedule_timetable_slot: {
    name: "reschedule_timetable_slot",
    description: "Déplacer une séance de cours existante vers un nouveau jour et/ou horaire avec vérification préalable des conflits.",
    requiresConfirmation: true,
    declaration: {
      name: "reschedule_timetable_slot",
      description: "Déplacer une séance de cours existante vers un autre créneau.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className", "subjectName", "currentDay", "targetDay", "newStartTime"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe." },
          subjectName: { type: SchemaType.STRING, description: "Matière de la séance à déplacer." },
          currentDay: { type: SchemaType.STRING, description: "Jour actuel de la séance (ex: 'mardi')." },
          targetDay: { type: SchemaType.STRING, description: "Nouveau jour de destination (ex: 'jeudi')." },
          newStartTime: { type: SchemaType.STRING, description: "Nouvelle heure de début (ex: '10:00')." },
          newEndTime: { type: SchemaType.STRING, description: "Nouvelle heure de fin optionnelle (ex: '12:00')." },
          newRoom: { type: SchemaType.STRING, description: "Nouvelle salle de classe optionnelle." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Déplacement de Séance</b>\n━━━━━━━━━━━━━━━━━━━━━━\nDéplacer la séance de <b>${args.subjectName}</b> (${args.className})\nDu <b>${args.currentDay}</b> vers le <b>${args.targetDay}</b> à <code>${args.newStartTime}</code> ?`;
    },
    execute: rescheduleTimetableSlotTool,
  },

  swap_timetable_slots: {
    name: "swap_timetable_slots",
    description: "Permuter / échanger deux séances de cours d'une même classe en vérifiant qu'aucun enseignant n'entre en conflit.",
    requiresConfirmation: true,
    declaration: {
      name: "swap_timetable_slots",
      description: "Échanger deux séances de cours dans l'emploi du temps d'une classe.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className", "day1", "time1", "day2", "time2"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe." },
          day1: { type: SchemaType.STRING, description: "Jour de la première séance (ex: 'mardi')." },
          time1: { type: SchemaType.STRING, description: "Heure de la première séance (ex: '08:00')." },
          day2: { type: SchemaType.STRING, description: "Jour de la deuxième séance (ex: 'jeudi')." },
          time2: { type: SchemaType.STRING, description: "Heure de la deuxième séance (ex: '10:00')." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Échange de Séances</b>\n━━━━━━━━━━━━━━━━━━━━━━\nÉchanger les cours de <code>${args.className}</code> entre le <b>${args.day1} ${args.time1}</b> et le <b>${args.day2} ${args.time2}</b> ?`;
    },
    execute: swapTimetableSlotsTool,
  },

  update_timetable_slot: {
    name: "update_timetable_slot",
    description: "Modifier l'enseignant, la matière ou la salle d'une séance existante dans l'emploi du temps.",
    requiresConfirmation: true,
    declaration: {
      name: "update_timetable_slot",
      description: "Modifier les caractéristiques d'une séance de cours existante.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className", "day", "time"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe." },
          day: { type: SchemaType.STRING, description: "Jour de la séance (ex: 'lundi')." },
          time: { type: SchemaType.STRING, description: "Heure de début (ex: '08:00')." },
          newTeacherName: { type: SchemaType.STRING, description: "Nouvel enseignant à assigner." },
          newSubjectName: { type: SchemaType.STRING, description: "Nouvelle matière." },
          newRoom: { type: SchemaType.STRING, description: "Nouvelle salle de classe." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const details = [
        args.newTeacherName ? `Prof: <b>${args.newTeacherName}</b>` : "",
        args.newSubjectName ? `Matière: <b>${args.newSubjectName}</b>` : "",
        args.newRoom ? `Salle: <b>${args.newRoom}</b>` : "",
      ].filter(Boolean).join(" | ");
      return `❓ <b>Modification de Séance</b>\n━━━━━━━━━━━━━━━━━━━━━━\nModifier la séance de <code>${args.className}</code> le <b>${args.day} à ${args.time}</b> ?\n${details}`;
    },
    execute: updateTimetableSlotTool,
  },

  delete_timetable_slot: {
    name: "delete_timetable_slot",
    description: "Supprimer / annuler une séance de cours dans l'emploi du temps d'une classe.",
    requiresConfirmation: true,
    declaration: {
      name: "delete_timetable_slot",
      description: "Supprimer une séance de cours de l'emploi du temps.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["className", "day", "timeOrSubject"],
        properties: {
          className: { type: SchemaType.STRING, description: "Nom de la classe." },
          day: { type: SchemaType.STRING, description: "Jour de la séance (ex: 'mardi')." },
          timeOrSubject: { type: SchemaType.STRING, description: "Heure de la séance (ex: '08:00') ou nom de la matière (ex: 'Physique')." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      return `❓ <b>Suppression de Séance</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSupprimer la séance de <b>${args.timeOrSubject}</b> pour <code>${args.className}</code> le <b>${args.day}</b> ?\n⚠️ Cette action retirera le cours du planning.`;
    },
    execute: deleteTimetableSlotTool,
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
    description: "Publier une ressource pédagogique, un cours ou document pour une classe d'élèves. STRICTEMENT RÉSERVÉ aux documents scolaires attachés (PDF, Word, photo). INTERDICTION STRICTE d'appeler cet outil pour des questions de cuisine, recettes culinaires, questions personnelles ou sans fichier.",
    requiresConfirmation: true,
    declaration: {
      name: "add_resource",
      description: "Partager des documents de cours ou fiches d'exercices avec les élèves d'une classe. Nécessite obligatoirement un document/fichier scolaire déjà attaché. Ne JAMAIS appeler pour des questions de cuisine (recette de pizza, etc.) ou culture générale.",
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

  update_income: {
    name: "update_income",
    description: "Modifier une recette ou un revenu enregistré dans le registre financier (titre, montant, catégorie, date ou justificatif).",
    requiresConfirmation: true,
    declaration: {
      name: "update_income",
      description: "Modifier un revenu ou une recette existante dans le registre.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          incomeId: { type: SchemaType.NUMBER, description: "Identifiant numérique du revenu si connu." },
          query: { type: SchemaType.STRING, description: "Titre ou libellé du revenu à rechercher (ex: 'Donation', 'Cantine')." },
          newTitle: { type: SchemaType.STRING, description: "Nouveau titre ou libellé." },
          newAmount: { type: SchemaType.NUMBER, description: "Nouveau montant en Dinars Tunisiens (DT)." },
          newCategory: { type: SchemaType.STRING, description: "Nouvelle catégorie (ex: 'Cantine', 'Transport', 'Tuition', 'Dons')." },
          newDate: { type: SchemaType.STRING, description: "Nouvelle date (AAAA-MM-JJ)." },
          newImg: { type: SchemaType.STRING, description: "Nouvelle URL de reçu ou justificatif." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const q = args.query ? ` "${args.query}"` : (args.incomeId ? ` N°${args.incomeId}` : "");
      const details: string[] = [];
      if (args.newTitle) details.push(`Nouveau titre : <b>${args.newTitle}</b>`);
      if (args.newAmount !== undefined) details.push(`Nouveau montant : <code>${args.newAmount} DT</code>`);
      if (args.newCategory) details.push(`Nouvelle catégorie : <code>${args.newCategory}</code>`);
      if (args.newDate) details.push(`Nouvelle date : <code>${args.newDate}</code>`);
      return `❓ <b>Confirmation : Modification de Revenu</b>\n━━━━━━━━━━━━━━━━━━━━━━\nRevenu ciblé : <b>${q}</b>\n• ${details.join("\n• ")}\n\nConfirmer la modification ?`;
    },
    execute: updateIncomeTool,
  },

  delete_income: {
    name: "delete_income",
    description: "Supprimer ou annuler un revenu / recette enregistré par erreur dans le registre financier.",
    requiresConfirmation: true,
    declaration: {
      name: "delete_income",
      description: "Supprimer une recette ou un revenu enregistré par erreur.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          incomeId: { type: SchemaType.NUMBER, description: "Identifiant numérique du revenu si connu." },
          query: { type: SchemaType.STRING, description: "Titre ou libellé du revenu (ex: 'Donation', 'Cantine')." },
          amount: { type: SchemaType.NUMBER, description: "Montant du revenu en Dinars Tunisiens (DT)." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const q = args.query ? ` "${args.query}"` : "";
      const amt = args.amount ? ` de ${args.amount} DT` : "";
      return `❓ <b>Confirmation : Suppression de Revenu</b>\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ Vous êtes sur le point de supprimer le revenu${q}${amt} du registre financier.\n\nConfirmer la suppression ?`;
    },
    execute: deleteIncomeTool,
  },

  update_expense: {
    name: "update_expense",
    description: "Modifier une dépense opérationnelle enregistrée (titre, montant, catégorie, date ou justificatif).",
    requiresConfirmation: true,
    declaration: {
      name: "update_expense",
      description: "Modifier une dépense existante dans la comptabilité.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          expenseId: { type: SchemaType.NUMBER, description: "Identifiant numérique de la dépense si connu." },
          query: { type: SchemaType.STRING, description: "Titre ou libellé de la dépense à rechercher (ex: 'Facture STEG', 'Achat essence')." },
          newTitle: { type: SchemaType.STRING, description: "Nouveau titre ou libellé de la dépense." },
          newAmount: { type: SchemaType.NUMBER, description: "Nouveau montant en Dinars Tunisiens (DT)." },
          newCategory: { type: SchemaType.STRING, description: "Nouvelle catégorie (ex: 'Factures', 'Fournitures', 'Transport', 'Maintenance')." },
          newDate: { type: SchemaType.STRING, description: "Nouvelle date (AAAA-MM-JJ)." },
          newImg: { type: SchemaType.STRING, description: "Nouvelle URL de facture ou reçu." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const q = args.query ? ` "${args.query}"` : (args.expenseId ? ` N°${args.expenseId}` : "");
      const details: string[] = [];
      if (args.newTitle) details.push(`Nouveau titre : <b>${args.newTitle}</b>`);
      if (args.newAmount !== undefined) details.push(`Nouveau montant : <code>${args.newAmount} DT</code>`);
      if (args.newCategory) details.push(`Nouvelle catégorie : <code>${args.newCategory}</code>`);
      if (args.newDate) details.push(`Nouvelle date : <code>${args.newDate}</code>`);
      return `❓ <b>Confirmation : Modification de Dépense</b>\n━━━━━━━━━━━━━━━━━━━━━━\nDépense ciblée : <b>${q}</b>\n• ${details.join("\n• ")}\n\nConfirmer la modification ?`;
    },
    execute: updateExpenseTool,
  },

  get_audit_log: {
    name: "get_audit_log",
    description: "Consulter et rechercher dans le journal d'audit officiel de l'école (/admin/audit) : historique des actions administratives (créations, modifications, suppressions, encaissements, salaires, heures d'absence, etc.), filtrable par date, utilisateur, type d'action ou mot-clé.",
    requiresConfirmation: false,
    declaration: {
      name: "get_audit_log",
      description: "Rechercher et consulter les entrées du journal d'audit de l'école (/admin/audit).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { type: SchemaType.STRING, description: "Mot-clé de recherche (ex: 'suppression', 'salaire', nom d'un élève ou enseignant)." },
          action: { type: SchemaType.STRING, description: "Type d'action (ex: 'CREATE', 'UPDATE', 'DELETE', 'PAY_SALARY', 'PAY_ADVANCE', 'RECORD_PAYMENT', 'ADD_EXPENSE', 'CANCEL_PAYMENT')." },
          entityType: { type: SchemaType.STRING, description: "Entité concernée (ex: 'Student', 'Teacher', 'Staff', 'Parent', 'Class', 'Payment', 'Expense', 'Income')." },
          performedBy: { type: SchemaType.STRING, description: "Nom ou identifiant de l'auteur de l'action (ex: 'Hnia AI', 'fares selmi')." },
          date: { type: SchemaType.STRING, description: "Date cible au format AAAA-MM-JJ ou 'today' / 'yesterday'." },
          limit: { type: SchemaType.NUMBER, description: "Nombre de résultats à afficher (défaut 20, max 50)." },
        },
      },
    },
    execute: getAuditLogTool,
  },

  add_audit_entry: {
    name: "add_audit_entry",
    description: "Ajouter une note administrative officielle, consigner un incident ou enregistrer une inspection dans le journal d'audit de l'école.",
    requiresConfirmation: true,
    declaration: {
      name: "add_audit_entry",
      description: "Consigner une note administrative ou incident dans le journal d'audit officiel.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["description"],
        properties: {
          description: { type: SchemaType.STRING, description: "Description détaillée de l'événement, note administrative ou incident." },
          action: { type: SchemaType.STRING, description: "Type d'action : 'ADMIN_NOTE', 'INCIDENT', 'INSPECTION', 'MEETING', 'COMPLIANCE' (défaut 'ADMIN_NOTE')." },
          entityType: { type: SchemaType.STRING, description: "Entité concernée (ex: 'School', 'Administration', 'Student', 'Teacher')." },
          amount: { type: SchemaType.NUMBER, description: "Montant financier éventuel lié à cet événement." },
        },
      },
    },
    formatConfirmationMessage: (args) => {
      const act = args.action || "ADMIN_NOTE";
      return `❓ <b>Confirmation : Entrée Journal d'Audit</b>\n━━━━━━━━━━━━━━━━━━━━━━\n🔖 Type : <code>${act}</code>\n📝 Description : <i>"${args.description}"</i>\n\nConfirmer l'enregistrement dans le journal officiel d'audit ?`;
    },
    execute: addAuditEntryTool,
  },

  update_student: {
    name: "update_student",
    description:
      "Mettre à jour les informations d'un élève : prénom, nom, classe, tarif mensuel de scolarité, téléphone, adresse, date de naissance, sexe, photo de profil, ou parent rattaché.",
    requiresConfirmation: true,
    declaration: {
      name: "update_student",
      description: "Modifier la fiche complète d'un élève existant.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom ou identifiant de l'élève." },
          className: { type: SchemaType.STRING, description: "Classe actuelle de l'élève (optionnel pour lever toute ambiguïté)." },
          name: { type: SchemaType.STRING, description: "Nouveau prénom de l'élève." },
          surname: { type: SchemaType.STRING, description: "Nouveau nom de famille de l'élève." },
          newClassName: { type: SchemaType.STRING, description: "Nouvelle classe d'affectation / transfert (ex: '2B')." },
          customTuition: { type: SchemaType.NUMBER, description: "Nouveau tarif mensuel personnalisé en DT (ex: 420)." },
          phone: { type: SchemaType.STRING, description: "Nouveau téléphone personnel de l'élève." },
          address: { type: SchemaType.STRING, description: "Nouvelle adresse de domicile." },
          birthday: { type: SchemaType.STRING, description: "Date de naissance (AAAA-MM-JJ)." },
          sex: { type: SchemaType.STRING, description: "Sexe ('MALE' ou 'FEMALE')." },
          img: { type: SchemaType.STRING, description: "URL de la photo de profil / avatar." },
          parentNameOrPhone: { type: SchemaType.STRING, description: "Nom ou numéro de téléphone du parent à associer." },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      const parts: string[] = [];
      if (args.name) parts.push(`Prénom : <b>${args.name}</b>`);
      if (args.surname) parts.push(`Nom : <b>${args.surname}</b>`);
      if (args.newClassName) parts.push(`Nouvelle classe : <code>${args.newClassName}</code>`);
      if (args.customTuition !== undefined) parts.push(`Tarif mensuel : <code>${args.customTuition} DT/mois</code>`);
      if (args.phone) parts.push(`Téléphone : <code>${args.phone}</code>`);
      if (args.address) parts.push(`Adresse : <code>${args.address}</code>`);
      if (args.birthday) parts.push(`Date de naissance : <code>${args.birthday}</code>`);
      if (args.sex) parts.push(`Sexe : <code>${args.sex}</code>`);
      if (args.img) parts.push(`Photo de profil : <i>Mise à jour de l'image</i> 🖼️`);
      if (args.parentNameOrPhone) parts.push(`Parent / Tuteur : <b>${args.parentNameOrPhone}</b>`);

      if (isArabic) {
        return `✏️ <b>تأكيد تعديل ملف التلميذ</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>التلميذ :</b> <b>${args.studentNameOrId}</b>\n${parts.map((p) => `• ${p}`).join("\n")}\n\nهل ترغب في تطبيق هذه التعديلات ؟`;
      }
      return `✏️ <b>Confirmation : Modification Fiche Élève</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Élève :</b> <b>${args.studentNameOrId}</b>\n${parts.map((p) => `• ${p}`).join("\n")}\n\nSouhaitez-vous appliquer ces changements immédiatement ?`;
    },
    execute: updateStudentTool,
  },

  delete_student: {
    name: "delete_student",
    description:
      "Supprimer définitivement un élève du registre scolaire avec suppression sécurisée en cascade de son historique (notes, présences, résultats, paiements, notifications). Action irréversible protégée par confirmation.",
    requiresConfirmation: true,
    declaration: {
      name: "delete_student",
      description: "Supprimer définitivement un élève de l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["studentNameOrId"],
        properties: {
          studentNameOrId: { type: SchemaType.STRING, description: "Nom complet ou identifiant de l'élève à supprimer." },
          className: { type: SchemaType.STRING, description: "Classe de l'élève (optionnel pour lever toute ambiguïté)." },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      if (isArabic) {
        return `⚠️ <b>تحذير هام : حذف تلميذ نهائياً</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>التلميذ :</b> <b>${args.studentNameOrId}</b>${args.className ? `\n🏫 <b>القسم :</b> <code>${args.className}</code>` : ""}\n\n⚠️ <i>سيتم حذف هذا التلميذ نهائياً مع كافة الأعداد، الغيابات وسجلات الخلاص المرتبطة به.</i>\n\nهل أنت متأكد من تأكيد الحذف ؟`;
      }
      return `⚠️ <b>Avertissement : Suppression Définitive d'Élève</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Élève :</b> <b>${args.studentNameOrId}</b>${args.className ? `\n🏫 <b>Classe :</b> <code>${args.className}</code>` : ""}\n\n⚠️ <i>Cette action supprimera irréversiblement l'élève ainsi que son historique de notes, présences et paiements.</i>\n\nSouhaitez-vous confirmer la suppression ?`;
    },
    execute: deleteStudentTool,
  },

  update_parent: {
    name: "update_parent",
    description:
      "Modifier la fiche d'un parent ou tuteur : prénom, nom, téléphone de contact, adresse de domicile, ou photo de profil.",
    requiresConfirmation: true,
    declaration: {
      name: "update_parent",
      description: "Mettre à jour les coordonnées et informations d'un parent ou tuteur.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["parentNameOrId"],
        properties: {
          parentNameOrId: { type: SchemaType.STRING, description: "Nom complet, identifiant ou téléphone du parent à modifier." },
          name: { type: SchemaType.STRING, description: "Nouveau prénom du parent." },
          surname: { type: SchemaType.STRING, description: "Nouveau nom de famille du parent." },
          phone: { type: SchemaType.STRING, description: "Nouveau numéro de téléphone (8 chiffres)." },
          address: { type: SchemaType.STRING, description: "Nouvelle adresse de domicile." },
          img: { type: SchemaType.STRING, description: "URL de la photo de profil / avatar." },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      const parts: string[] = [];
      if (args.name) parts.push(`Prénom : <b>${args.name}</b>`);
      if (args.surname) parts.push(`Nom : <b>${args.surname}</b>`);
      if (args.phone) parts.push(`Téléphone : <code>${args.phone}</code>`);
      if (args.address) parts.push(`Adresse : <code>${args.address}</code>`);
      if (args.img) parts.push(`Photo de profil : <i>Mise à jour de l'image</i> 🖼️`);

      if (isArabic) {
        return `👨‍👩‍👧 <b>تأكيد تعديل ملف الولي</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>الولي :</b> <b>${args.parentNameOrId}</b>\n${parts.map((p) => `• ${p}`).join("\n")}\n\nهل ترغب في حفظ هذه التعديلات ؟`;
      }
      return `👨‍👩‍👧 <b>Confirmation : Modification Fiche Parent</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Parent :</b> <b>${args.parentNameOrId}</b>\n${parts.map((p) => `• ${p}`).join("\n")}\n\nSouhaitez-vous confirmer ces modifications ?`;
    },
    execute: updateParentTool,
  },

  delete_parent: {
    name: "delete_parent",
    description:
      "Supprimer un parent ou tuteur du registre scolaire en détachant en toute sécurité ses enfants inscrits pour préserver leurs dossiers scolaires. Action irréversible.",
    requiresConfirmation: true,
    declaration: {
      name: "delete_parent",
      description: "Supprimer un parent du registre de l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["parentNameOrId"],
        properties: {
          parentNameOrId: { type: SchemaType.STRING, description: "Nom complet, identifiant ou téléphone du parent à supprimer." },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      if (isArabic) {
        return `⚠️ <b>تحذير : حذف حساب ولي أمر</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>الولي :</b> <b>${args.parentNameOrId}</b>\n\nℹ️ <i>سيتم حذف حساب الولي مع الاحتفاظ بملفات أبنائه في المدرسة مع فصلهم عنه.</i>\n\nهل تؤكد حذف هذا الولي ؟`;
      }
      return `⚠️ <b>Avertissement : Suppression de Fiche Parent</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Parent :</b> <b>${args.parentNameOrId}</b>\n\nℹ️ <i>Les dossiers scolaires des enfants seront préservés mais détachés de ce parent.</i>\n\nSouhaitez-vous confirmer la suppression de ce parent ?`;
    },
    execute: deleteParentTool,
  },

  update_teacher: {
    name: "update_teacher",
    description:
      "Modifier la fiche d'un enseignant : prénom, nom, téléphone, adresse, salaire de base, taux horaire, volume d'heures mensuelles, matières enseignées, classes assignées, date de naissance, sexe, ou photo de profil.",
    requiresConfirmation: true,
    declaration: {
      name: "update_teacher",
      description: "Modifier la fiche et les paramètres d'un enseignant.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["teacherNameOrId"],
        properties: {
          teacherNameOrId: { type: SchemaType.STRING, description: "Nom complet ou identifiant de l'enseignant." },
          name: { type: SchemaType.STRING, description: "Nouveau prénom de l'enseignant." },
          surname: { type: SchemaType.STRING, description: "Nouveau nom de famille de l'enseignant." },
          phone: { type: SchemaType.STRING, description: "Nouveau numéro de téléphone." },
          address: { type: SchemaType.STRING, description: "Nouvelle adresse de domicile." },
          salary: { type: SchemaType.NUMBER, description: "Nouveau salaire de base en DT/mois." },
          hourlyRate: { type: SchemaType.NUMBER, description: "Nouveau taux horaire en DT/h." },
          hoursPerMonth: { type: SchemaType.NUMBER, description: "Nouveau volume horaire mensuel prévu (ex: 120)." },
          birthday: { type: SchemaType.STRING, description: "Date de naissance (AAAA-MM-JJ)." },
          sex: { type: SchemaType.STRING, description: "Sexe ('MALE' ou 'FEMALE')." },
          img: { type: SchemaType.STRING, description: "URL de la photo de profil / avatar." },
          subjectNames: {
            type: SchemaType.ARRAY,
            description: "Liste des noms des matières enseignées par ce professeur.",
            items: { type: SchemaType.STRING },
          },
          classNames: {
            type: SchemaType.ARRAY,
            description: "Liste des noms des classes assignées à ce professeur (ex: ['1A', '2B']).",
            items: { type: SchemaType.STRING },
          },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      const parts: string[] = [];
      if (args.name) parts.push(`Prénom : <b>${args.name}</b>`);
      if (args.surname) parts.push(`Nom : <b>${args.surname}</b>`);
      if (args.phone) parts.push(`Téléphone : <code>${args.phone}</code>`);
      if (args.address) parts.push(`Adresse : <code>${args.address}</code>`);
      if (args.salary !== undefined) parts.push(`Salaire : <code>${args.salary} DT/mois</code>`);
      if (args.hourlyRate !== undefined) parts.push(`Taux horaire : <code>${args.hourlyRate} DT/h</code>`);
      if (args.hoursPerMonth !== undefined) parts.push(`Volume horaire : <code>${args.hoursPerMonth}h</code>`);
      if (args.subjectNames && args.subjectNames.length > 0) parts.push(`Matières : <b>${args.subjectNames.join(", ")}</b>`);
      if (args.classNames && args.classNames.length > 0) parts.push(`Classes : <b>${args.classNames.join(", ")}</b>`);
      if (args.img) parts.push(`Photo de profil : <i>Mise à jour de l'image</i> 🖼️`);

      if (isArabic) {
        return `👨‍🏫 <b>تأكيد تعديل ملف الأستاذ</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>الأستاذ :</b> <b>${args.teacherNameOrId}</b>\n${parts.map((p) => `• ${p}`).join("\n")}\n\nهل ترغب في حفظ هذه التعديلات ؟`;
      }
      return `👨‍🏫 <b>Confirmation : Modification Fiche Enseignant</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Enseignant :</b> <b>${args.teacherNameOrId}</b>\n${parts.map((p) => `• ${p}`).join("\n")}\n\nSouhaitez-vous enregistrer ces modifications ?`;
    },
    execute: updateTeacherTool,
  },

  delete_teacher: {
    name: "delete_teacher",
    description:
      "Supprimer définitivement un enseignant du corps professoral en libérant automatiquement ses classes supervisées, cours et séances d'emploi du temps.",
    requiresConfirmation: true,
    declaration: {
      name: "delete_teacher",
      description: "Supprimer définitivement un enseignant de l'école.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["teacherNameOrId"],
        properties: {
          teacherNameOrId: { type: SchemaType.STRING, description: "Nom complet ou identifiant de l'enseignant à supprimer." },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      if (isArabic) {
        return `⚠️ <b>تحذير : حذف أستاذ من الإطار التربوي</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>الأستاذ :</b> <b>${args.teacherNameOrId}</b>\n\n⚠️ <i>سيتم تحرير الأقسام التي يشرف عليها وتفريغ حصصه من جدول الأوقات.</i>\n\nهل ترغب في تأكيد حذف هذا الأستاذ نهائياً ؟`;
      }
      return `⚠️ <b>Avertissement : Suppression d'Enseignant</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Enseignant :</b> <b>${args.teacherNameOrId}</b>\n\n⚠️ <i>Les classes sous sa supervision et ses séances d'emploi du temps seront automatiquement libérées.</i>\n\nSouhaitez-vous confirmer la suppression définitive de cet enseignant ?`;
    },
    execute: deleteTeacherTool,
  },

  update_staff: {
    name: "update_staff",
    description:
      "Modifier la fiche d'un membre du personnel non enseignant : prénom, nom, téléphone, adresse, salaire mensuel, poste/rôle, date de naissance, ou photo de profil.",
    requiresConfirmation: true,
    declaration: {
      name: "update_staff",
      description: "Modifier la fiche d'un collaborateur non enseignant.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["staffNameOrId"],
        properties: {
          staffNameOrId: { type: SchemaType.STRING, description: "Nom complet ou identifiant du collaborateur." },
          name: { type: SchemaType.STRING, description: "Nouveau prénom du collaborateur." },
          surname: { type: SchemaType.STRING, description: "Nouveau nom de famille." },
          phone: { type: SchemaType.STRING, description: "Nouveau numéro de téléphone." },
          address: { type: SchemaType.STRING, description: "Nouvelle adresse de domicile." },
          salary: { type: SchemaType.NUMBER, description: "Nouveau salaire mensuel en DT." },
          role: { type: SchemaType.STRING, description: "Nouveau poste ou rôle (ex: 'Administration', 'Chauffeur', 'Surveillant')." },
          birthday: { type: SchemaType.STRING, description: "Date de naissance (AAAA-MM-JJ)." },
          img: { type: SchemaType.STRING, description: "URL de la photo de profil / avatar." },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      const parts: string[] = [];
      if (args.name) parts.push(`Prénom : <b>${args.name}</b>`);
      if (args.surname) parts.push(`Nom : <b>${args.surname}</b>`);
      if (args.phone) parts.push(`Téléphone : <code>${args.phone}</code>`);
      if (args.address) parts.push(`Adresse : <code>${args.address}</code>`);
      if (args.role) parts.push(`Rôle : <b>${args.role}</b>`);
      if (args.salary !== undefined) parts.push(`Salaire : <code>${args.salary} DT</code>`);
      if (args.img) parts.push(`Photo de profil : <i>Mise à jour de l'image</i> 🖼️`);

      if (isArabic) {
        return `💼 <b>تأكيد تعديل ملف الموظف</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>الموظف :</b> <b>${args.staffNameOrId}</b>\n${parts.map((p) => `• ${p}`).join("\n")}\n\nهل ترغب في حفظ هذه التعديلات ؟`;
      }
      return `💼 <b>Confirmation : Modification Fiche Personnel</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Collaborateur :</b> <b>${args.staffNameOrId}</b>\n${parts.map((p) => `• ${p}`).join("\n")}\n\nSouhaitez-vous enregistrer ces modifications ?`;
    },
    execute: updateStaffTool,
  },

  delete_staff: {
    name: "delete_staff",
    description:
      "Supprimer définitivement un collaborateur du personnel non enseignant et archiver ses écritures de paie.",
    requiresConfirmation: true,
    declaration: {
      name: "delete_staff",
      description: "Supprimer définitivement un membre du personnel.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["staffNameOrId"],
        properties: {
          staffNameOrId: { type: SchemaType.STRING, description: "Nom complet ou identifiant du collaborateur à supprimer." },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      if (isArabic) {
        return `⚠️ <b>تحذير : حذف موظف نهائياً</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>الموظف :</b> <b>${args.staffNameOrId}</b>\n\nهل ترغب في تأكيد حذف هذا الموظف من قائمة العمل بالمؤسسة ؟`;
      }
      return `⚠️ <b>Avertissement : Suppression de Membre du Personnel</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Collaborateur :</b> <b>${args.staffNameOrId}</b>\n\nSouhaitez-vous confirmer la suppression définitive de ce collaborateur ?`;
    },
    execute: deleteStaffTool,
  },

  update_person_photo: {
    name: "update_person_photo",
    description:
      "Attribuer ou mettre à jour la photo de profil / avatar d'une personne de l'école (élève, enseignant, membre du personnel ou parent) à partir d'une photo reçue ou d'une URL d'image.",
    requiresConfirmation: true,
    declaration: {
      name: "update_person_photo",
      description: "Mettre à jour la photo de profil d'un élève, enseignant, personnel ou parent.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["personType", "nameOrId", "photoUrl"],
        properties: {
          personType: {
            type: SchemaType.STRING,
            description: "Type de personne : 'student' (élève), 'teacher' (enseignant), 'staff' (personnel), ou 'parent' (parent/tuteur).",
          },
          nameOrId: {
            type: SchemaType.STRING,
            description: "Nom complet ou identifiant de la personne.",
          },
          photoUrl: {
            type: SchemaType.STRING,
            description: "URL de la photo ou du portrait numérisé.",
          },
          className: {
            type: SchemaType.STRING,
            description: "Classe de l'élève si personType = 'student' (optionnel).",
          },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      const pLabel =
        args.personType === "student"
          ? (isArabic ? "تلميذ" : "Élève")
          : args.personType === "teacher"
          ? (isArabic ? "أستاذ" : "Enseignant")
          : args.personType === "staff"
          ? (isArabic ? "موظف" : "Personnel")
          : (isArabic ? "ولي أمر" : "Parent");

      if (isArabic) {
        return `📸 <b>تأكيد تحديث الصورة الشخصية</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>الشخص :</b> <b>${args.nameOrId}</b> (<i>${pLabel}</i>)${args.className ? `\n🏫 <b>القسم :</b> <code>${args.className}</code>` : ""}\n\nهل ترغب في تعيين هذه الصورة كصورة رسمية للملف الشخصي ؟`;
      }
      return `📸 <b>Confirmation : Mise à Jour Photo de Profil</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Personne :</b> <b>${args.nameOrId}</b> (<i>${pLabel}</i>)${args.className ? `\n🏫 <b>Classe :</b> <code>${args.className}</code>` : ""}\n\nSouhaitez-vous enregistrer cette nouvelle photo comme photo de profil officielle ?`;
    },
    execute: updatePersonPhotoTool,
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

  get_daily_cash_pdf: {
    name: "get_daily_cash_pdf",
    description: "Générer et envoyer directement en pièce jointe PDF A4 dans Telegram le bordereau officiel de clôture de caisse journalière (avec total recettes, total dépenses, solde net, ventilation espèces vs chèques au classeur, détail des entrées/sorties et zones d'émargement caissier/direction). À déclencher quand l'admin demande le bordereau de caisse PDF, la situation financière du jour en PDF, la feuille de caisse ou pour imprimer la caisse.",
    requiresConfirmation: false,
    declaration: {
      name: "get_daily_cash_pdf",
      description: "Générer et envoyer le bordereau officiel de clôture de caisse en document PDF A4 dans Telegram.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Date cible au format YYYY-MM-DD (optionnel, par défaut: aujourd'hui)." },
        },
      },
    },
    execute: getDailyCashPdfTool,
  },

  // ── EXTERNAL PORTAL SUITE (BROWSER AUTOMATION) ───────────────────────────
  search_external_student: {
    name: "search_external_student",
    description:
      "Rechercher un élève sur le portail externe de l'établissement (ex: ministère / plateforme centrale) par nom, prénom, identifiant ou classe via automatisation navigateur. À utiliser dès que l'administrateur demande des informations ou documents depuis la plateforme / portail externe (ex: 'جيبلي معلومات أحمد بن علي من المنصة', 'cherche Ahmed sur le portail').",
    requiresConfirmation: false,
    declaration: {
      name: "search_external_student",
      description:
        "Rechercher un élève sur le portail externe via automatisation de navigateur.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          studentName: {
            type: SchemaType.STRING,
            description: "Nom ou prénom de l'élève à rechercher (ex: 'Ahmed Ben Ali').",
          },
          studentIdentifier: {
            type: SchemaType.STRING,
            description: "Identifiant ou code élève (ex: 'STU-001').",
          },
          className: {
            type: SchemaType.STRING,
            description: "Classe de l'élève (optionnel, ex: '8ème B').",
          },
          portalId: {
            type: SchemaType.STRING,
            description: "Identifiant du portail (optionnel, défaut: 'mock-school-portal').",
          },
        },
      },
    },
    execute: searchExternalStudentTool,
  },

  get_external_student: {
    name: "get_external_student",
    description:
      "Consulter la fiche détaillée et le statut d'un élève sur le portail externe via son identifiant (ex: 'STU-001').",
    requiresConfirmation: false,
    declaration: {
      name: "get_external_student",
      description:
        "Consulter la fiche complète d'un élève sur le portail externe.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          externalStudentId: {
            type: SchemaType.STRING,
            description: "Identifiant externe de l'élève (ex: 'STU-001').",
          },
          portalId: {
            type: SchemaType.STRING,
            description: "Identifiant du portail (optionnel).",
          },
        },
        required: ["externalStudentId"],
      },
    },
    execute: getExternalStudentTool,
  },

  list_external_documents: {
    name: "list_external_documents",
    description:
      "Lister les documents officiels disponibles sur le portail externe pour un élève (certificat de scolarité, inscription, relevé de notes).",
    requiresConfirmation: false,
    declaration: {
      name: "list_external_documents",
      description:
        "Lister les documents disponibles pour un élève sur le portail externe.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          externalStudentId: {
            type: SchemaType.STRING,
            description: "Identifiant externe de l'élève (ex: 'STU-001').",
          },
          portalId: {
            type: SchemaType.STRING,
            description: "Identifiant du portail (optionnel).",
          },
        },
        required: ["externalStudentId"],
      },
    },
    execute: listExternalDocumentsTool,
  },

  download_external_document: {
    name: "download_external_document",
    description:
      "Télécharger un document officiel (PDF) depuis le portail externe pour un élève et le transmettre directement par Telegram. Action officielle requérant confirmation préalable de l'administrateur.",
    requiresConfirmation: true,
    declaration: {
      name: "download_external_document",
      description:
        "Télécharger et délivrer un document officiel (PDF) depuis le portail externe.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          externalStudentId: {
            type: SchemaType.STRING,
            description: "Identifiant externe de l'élève (ex: 'STU-001').",
          },
          documentType: {
            type: SchemaType.STRING,
            description:
              "Type ou nom du document à télécharger (ex: 'Certificat de scolarité', 'Inscription', 'Relevé').",
          },
          studentName: {
            type: SchemaType.STRING,
            description: "Nom complet de l'élève pour le libellé et l'envoi.",
          },
          portalId: {
            type: SchemaType.STRING,
            description: "Identifiant du portail (optionnel).",
          },
        },
        required: ["externalStudentId", "documentType"],
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      if (isArabic) {
        return `📄 <b>طلب تحميل وثيقة رسمية من المنصة</b>\n\n👤 <b>التلميذ :</b> <b>${
          args.studentName || args.externalStudentId
        }</b>\n📑 <b>الوثيقة :</b> <code>${
          args.documentType
        }</code>\n\nهل ترغب في تأكيد تحميل هذه الوثيقة الرسمية من المنصة وإرسالها في المحادثة بصيغة PDF ؟`;
      }
      return `📄 <b>Demande de document officiel externe</b>\n\n👤 <b>Élève :</b> <b>${
        args.studentName || args.externalStudentId
      }</b>\n📑 <b>Document :</b> <code>${
        args.documentType
      }</code>\n\nSouhaitez-vous que je télécharge ce document officiel depuis le portail externe et que je vous l'envoie en pièce jointe PDF ici ?`;
    },
    execute: downloadExternalDocumentTool,
  },

  // ── SUITE 12: SYSTEM, PROFILE & SCHOOL SETTINGS ───────────────────────────
  get_admin_profile: {
    name: "get_admin_profile",
    description:
      "Consulter le profil personnel, les coordonnées et les préférences de l'administrateur connecté (/profile) : nom, prénom, email, téléphone, avatar, langue de l'agent Hnia, et état du briefing matinal.",
    requiresConfirmation: false,
    declaration: {
      name: "get_admin_profile",
      description:
        "Consulter les informations personnelles et préférences de l'administrateur connecté (/profile).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
      },
    },
    execute: getAdminProfileTool,
  },

  update_admin_profile: {
    name: "update_admin_profile",
    description:
      "Modifier le profil de l'administrateur connecté (/profile) : prénom, nom, numéro de téléphone, email, photo/avatar, langue de communication ('fr', 'ar', 'en'), ou activer/désactiver le briefing matinal automatique.",
    requiresConfirmation: true,
    declaration: {
      name: "update_admin_profile",
      description:
        "Modifier les coordonnées, la photo ou les préférences de l'administrateur connecté (/profile).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          firstName: {
            type: SchemaType.STRING,
            description: "Nouveau prénom de l'administrateur.",
          },
          lastName: {
            type: SchemaType.STRING,
            description: "Nouveau nom de famille de l'administrateur.",
          },
          phone: {
            type: SchemaType.STRING,
            description: "Nouveau numéro de téléphone de l'administrateur (ex: '20123456' ou '+216 20 123 456').",
          },
          email: {
            type: SchemaType.STRING,
            description: "Nouvelle adresse email de l'administrateur.",
          },
          img: {
            type: SchemaType.STRING,
            description: "URL de la nouvelle photo de profil / avatar.",
          },
          language: {
            type: SchemaType.STRING,
            description: "Langue préférée pour les échanges avec Hnia ('fr' pour Français, 'ar' pour Arabe, 'en' pour Anglais).",
          },
          dailyBriefing: {
            type: SchemaType.BOOLEAN,
            description: "Activer (true) ou désactiver (false) le briefing matinal automatique sur Telegram.",
          },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      const parts: string[] = [];
      if (args.firstName) parts.push(isArabic ? `الاسم : <b>${args.firstName}</b>` : `Prénom : <b>${args.firstName}</b>`);
      if (args.lastName) parts.push(isArabic ? `اللقب : <b>${args.lastName}</b>` : `Nom : <b>${args.lastName}</b>`);
      if (args.phone) parts.push(isArabic ? `الهاتف : <code>${args.phone}</code>` : `Téléphone : <code>${args.phone}</code>`);
      if (args.email) parts.push(isArabic ? `البريد الإلكتروني : <code>${args.email}</code>` : `Email : <code>${args.email}</code>`);
      if (args.img) parts.push(isArabic ? `الصورة الشخصية : <i>تحديث الصورة</i> 🖼️` : `Photo de profil : <i>Mise à jour de l'image</i> 🖼️`);
      if (args.language) parts.push(isArabic ? `لغة التواصل : <code>${args.language.toUpperCase()}</code>` : `Langue préférée : <code>${args.language.toUpperCase()}</code>`);
      if (args.dailyBriefing !== undefined) {
        const stateStr = args.dailyBriefing ? (isArabic ? "مفعّل ✅" : "Activé ✅") : (isArabic ? "معطّل ❌" : "Désactivé ❌");
        parts.push(isArabic ? `التقرير الصباحي اليومي : <code>${stateStr}</code>` : `Briefing quotidien : <code>${stateStr}</code>`);
      }

      if (isArabic) {
        return `👤 <b>تحديث الملف الشخصي للمدير</b>\n━━━━━━━━━━━━━━━━━━━━━━\nهل ترغب في تأكيد حفظ هذه التعديلات على حسابك ؟\n${parts.map((p) => `• ${p}`).join("\n")}`;
      }
      return `👤 <b>Mise à Jour de Votre Profil Administrateur</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous appliquer ces modifications à votre profil ?\n${parts.map((p) => `• ${p}`).join("\n")}`;
    },
    execute: updateAdminProfileTool,
  },

  get_school_settings: {
    name: "get_school_settings",
    description:
      "Consulter les paramètres officiels de l'établissement scolaire (/settings) : nom de l'école, téléphone officiel, adresse physique, logo, année scolaire active, trimestre en cours, horaires d'ouverture et tarifs de scolarité de référence par niveau.",
    requiresConfirmation: false,
    declaration: {
      name: "get_school_settings",
      description:
        "Consulter les informations et paramètres généraux de l'école (/settings).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
      },
    },
    execute: getSchoolSettingsTool,
  },

  update_school_settings: {
    name: "update_school_settings",
    description:
      "Modifier les paramètres généraux de l'établissement scolaire (/settings) : nom de l'établissement, téléphone officiel, adresse physique, logo officiel, année scolaire (ex: '2026-2027'), trimestre en cours (1, 2, ou 3), heure d'ouverture (ex: '08:00') et heure de fermeture (ex: '14:00' ou '17:00').",
    requiresConfirmation: true,
    declaration: {
      name: "update_school_settings",
      description:
        "Modifier les paramètres généraux et coordonnées de l'établissement scolaire (/settings).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          schoolName: {
            type: SchemaType.STRING,
            description: "Nouveau nom officiel de l'école / établissement.",
          },
          phone: {
            type: SchemaType.STRING,
            description: "Numéro de téléphone officiel de l'établissement.",
          },
          address: {
            type: SchemaType.STRING,
            description: "Adresse physique officielle de l'école.",
          },
          schoolLogo: {
            type: SchemaType.STRING,
            description: "URL du nouveau logo officiel de l'établissement.",
          },
          academicYear: {
            type: SchemaType.STRING,
            description: "Année scolaire active (ex: '2026-2027').",
          },
          currentSemester: {
            type: SchemaType.NUMBER,
            description: "Trimestre ou semestre en cours (1, 2, ou 3).",
          },
          dayStartTime: {
            type: SchemaType.STRING,
            description: "Heure d'ouverture des cours (ex: '08:00').",
          },
          dayEndTime: {
            type: SchemaType.STRING,
            description: "Heure de fermeture des cours (ex: '14:00' ou '17:00').",
          },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      const parts: string[] = [];
      if (args.schoolName) parts.push(isArabic ? `اسم المؤسسة : <b>${args.schoolName}</b>` : `Nom de l'école : <b>${args.schoolName}</b>`);
      if (args.phone) parts.push(isArabic ? `الهاتف الرسمي : <code>${args.phone}</code>` : `Téléphone officiel : <code>${args.phone}</code>`);
      if (args.address) parts.push(isArabic ? `العنوان : <code>${args.address}</code>` : `Adresse officielle : <code>${args.address}</code>`);
      if (args.schoolLogo) parts.push(isArabic ? `شعار المدرسة : <i>تحديث الشعار</i> 🏫` : `Logo de l'école : <i>Mise à jour du logo</i> 🏫`);
      if (args.academicYear) parts.push(isArabic ? `السنة الدراسية : <code>${args.academicYear}</code>` : `Année scolaire : <code>${args.academicYear}</code>`);
      if (args.currentSemester) parts.push(isArabic ? `الثلاثي الجاري : <code>الثلاثي ${args.currentSemester}</code>` : `Trimestre en cours : <code>Trimestre ${args.currentSemester}</code>`);
      if (args.dayStartTime) parts.push(isArabic ? `توقيت فتح الأبواب : <code>${args.dayStartTime}</code>` : `Heure d'ouverture : <code>${args.dayStartTime}</code>`);
      if (args.dayEndTime) parts.push(isArabic ? `توقيت انتهاء الدروس : <code>${args.dayEndTime}</code>` : `Heure de fermeture : <code>${args.dayEndTime}</code>`);

      if (isArabic) {
        return `⚙️ <b>تعديل إعدادات المؤسسة التعليمية</b>\n━━━━━━━━━━━━━━━━━━━━━━\nهل ترغب في تطبيق هذه الإعدادات على المؤسسة ؟\n${parts.map((p) => `• ${p}`).join("\n")}`;
      }
      return `⚙️ <b>Modification des Paramètres de l'Établissement</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSouhaitez-vous enregistrer ces nouveaux paramètres pour l'école ?\n${parts.map((p) => `• ${p}`).join("\n")}`;
    },
    execute: updateSchoolSettingsTool,
  },

  update_level_tuition_fee: {
    name: "update_level_tuition_fee",
    description:
      "Modifier le montant standard mensuel des frais de scolarité pour un niveau académique donné (ex: niveau 0 pour Préparatoire, 1 pour 1ère année, 7, 8, etc.).",
    requiresConfirmation: true,
    declaration: {
      name: "update_level_tuition_fee",
      description:
        "Modifier le tarif mensuel des frais de scolarité d'un niveau d'études.",
      parameters: {
        type: SchemaType.OBJECT,
        required: ["levelNumber", "tuitionFee"],
        properties: {
          levelNumber: {
            type: SchemaType.NUMBER,
            description: "Numéro du niveau d'études (ex: 0 pour Préparatoire, 1, 2, 7, 8, 9, etc.).",
          },
          tuitionFee: {
            type: SchemaType.NUMBER,
            description: "Nouveau tarif mensuel de base en Dinars Tunisiens (ex: 180, 220).",
          },
        },
      },
    },
    formatConfirmationMessage: (args, context) => {
      const isArabic = context.language === "ar";
      const levelLabel = args.levelNumber === 0 ? (isArabic ? "التحضيري" : "Préparatoire") : (isArabic ? `السنة ${args.levelNumber}` : `${args.levelNumber}ème année`);
      if (isArabic) {
        return `🎓 <b>تعديل معلوم التمدرس الشهري</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📚 <b>المستوى :</b> <b>${levelLabel}</b>\n💰 <b>المعلوم الجديد المقترح :</b> <code>${args.tuitionFee} د.ت/شهرياً</code>\n\nهل ترغب في تأكيد هذا التعديل وتطبيقه على المنظومة ؟`;
      }
      return `🎓 <b>Modification du Tarif de Scolarité</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📚 <b>Niveau :</b> <b>${levelLabel}</b>\n💰 <b>Nouveau tarif proposé :</b> <code>${args.tuitionFee} DT/mois</code>\n\nSouhaitez-vous confirmer cette mise à jour tarifaire ?`;
    },
    execute: updateLevelTuitionFeeTool,
  },
};

/**
 * Returns array of Gemini Function Declarations for model initialization
 */
export function getGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return Object.values(TOOLS).map((t) => t.declaration);
}
