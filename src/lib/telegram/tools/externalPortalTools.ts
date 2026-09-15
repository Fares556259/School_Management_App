/**
 * External Portal Business Tools for Hnia
 *
 * Exposes high-level domain actions to Gemini agent:
 * - search_external_student
 * - get_external_student
 * - list_external_documents
 * - download_external_document (Requires confirmation before delivering official PDF)
 *
 * The LLM NEVER receives raw browser or DOM access.
 */

import { ToolContext } from "./readTools";
import { externalPortalService } from "@/lib/externalPortals/externalPortalService";
import { sendTelegramDocument } from "@/lib/telegram/telegram";

/**
 * Tool: search_external_student
 * Search students on the external school portal.
 */
export async function searchExternalStudentTool(
  args: {
    studentName?: string;
    studentIdentifier?: string;
    className?: string;
    portalId?: string;
  },
  context: ToolContext
) {
  try {
    const students = await externalPortalService.searchStudent(
      {
        studentName: args.studentName,
        studentIdentifier: args.studentIdentifier,
        className: args.className,
      },
      {
        schoolId: context.schoolId,
        adminId: context.adminId,
        adminName: context.adminName,
        portalId: args.portalId,
      }
    );

    if (students.length === 0) {
      return {
        success: true,
        count: 0,
        students: [],
        message: `Aucun élève correspondant trouvé sur le portail externe pour la recherche "${
          args.studentName || args.studentIdentifier || ""
        }".`,
      };
    }

    return {
      success: true,
      count: students.length,
      hasAmbiguity: students.length > 1,
      students: students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        className: s.className,
        status: s.status,
        registrationDate: s.registrationDate,
      })),
    };
  } catch (err: any) {
    console.error("[ExternalPortalTools] search_external_student error:", err);
    return {
      success: false,
      error: true,
      message: err.message || "Erreur lors de la recherche sur le portail externe.",
    };
  }
}

/**
 * Tool: get_external_student
 * Retrieve detailed student information from the external portal.
 */
export async function getExternalStudentTool(
  args: {
    externalStudentId: string;
    portalId?: string;
  },
  context: ToolContext
) {
  try {
    const student = await externalPortalService.getStudent(args.externalStudentId, {
      schoolId: context.schoolId,
      adminId: context.adminId,
      adminName: context.adminName,
      portalId: args.portalId,
    });

    return {
      success: true,
      student,
    };
  } catch (err: any) {
    console.error("[ExternalPortalTools] get_external_student error:", err);
    return {
      success: false,
      error: true,
      message: err.message || "Impossible de récupérer les détails de l'élève sur le portail.",
    };
  }
}

/**
 * Tool: list_external_documents
 * List documents available on the portal for a student.
 */
export async function listExternalDocumentsTool(
  args: {
    externalStudentId: string;
    portalId?: string;
  },
  context: ToolContext
) {
  try {
    const documents = await externalPortalService.listDocuments(args.externalStudentId, {
      schoolId: context.schoolId,
      adminId: context.adminId,
      adminName: context.adminName,
      portalId: args.portalId,
    });

    return {
      success: true,
      count: documents.length,
      externalStudentId: args.externalStudentId,
      documents,
    };
  } catch (err: any) {
    console.error("[ExternalPortalTools] list_external_documents error:", err);
    return {
      success: false,
      error: true,
      message: err.message || "Impossible de lister les documents de l'élève sur le portail.",
    };
  }
}

/**
 * Tool: download_external_document
 * Downloads an official document and delivers the PDF to Telegram.
 * Requires explicit administrator confirmation before execution.
 */
export async function downloadExternalDocumentTool(
  args: {
    externalStudentId: string;
    documentType: string;
    studentName?: string;
    portalId?: string;
  },
  context: ToolContext
) {
  try {
    const downloaded = await externalPortalService.downloadDocument(
      args.externalStudentId,
      args.documentType,
      {
        schoolId: context.schoolId,
        adminId: context.adminId,
        adminName: context.adminName,
        portalId: args.portalId,
      }
    );

    // If Telegram chatId is available, send the real PDF directly into the conversation
    if (context.chatId) {
      const caption =
        context.language === "ar"
          ? `✅ <b>تم تحميل الوثيقة الرسمية من المنصة بنجاح</b>\n📄 <code>${downloaded.filename}</code>\n👤 <b>التلميذ :</b> ${
              args.studentName || args.externalStudentId
            }`
          : `✅ <b>Document officiel récupéré depuis le portail</b>\n📄 <code>${downloaded.filename}</code>\n👤 <b>Élève :</b> ${
              args.studentName || args.externalStudentId
            }`;

      await sendTelegramDocument(context.chatId, downloaded.buffer, downloaded.filename, {
        caption,
        parse_mode: "HTML",
      });
    }

    // Clean up temporary disk storage
    if (downloaded.localPath) {
      externalPortalService.cleanupTempFile(downloaded.localPath);
    }

    return {
      success: true,
      filename: downloaded.filename,
      size: downloaded.size,
      mimeType: downloaded.mimeType,
      message:
        context.language === "ar"
          ? `✅ تم تحميل وثيقة "${downloaded.filename}" وإرسالها في المحادثة بنجاح.`
          : `✅ Document **${downloaded.filename}** téléchargé et envoyé avec succès.`,
    };
  } catch (err: any) {
    console.error("[ExternalPortalTools] download_external_document error:", err);
    return {
      success: false,
      error: true,
      message:
        context.language === "ar"
          ? `⚠️ تعذر تحميل الوثيقة من المنصة: ${err.message}`
          : `⚠️ Impossible de télécharger le document depuis le portail : ${err.message}`,
    };
  }
}
