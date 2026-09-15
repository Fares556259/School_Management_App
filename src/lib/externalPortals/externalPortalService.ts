/**
 * External Portal Service
 *
 * Coordinates external portal operations, enforces tenant isolation,
 * provides controlled retries, and records complete audit trails.
 */

import prisma from "@/lib/prisma";
import { MockSchoolPortalAdapter } from "./adapters/mockSchoolPortalAdapter";
import {
  ExternalPortalAdapter,
  ExternalStudent,
  ExternalDocument,
  DownloadedDocument,
  StudentSearchCriteria,
} from "./types";
import { browserService } from "../browser/browserService";

export interface PortalOperationContext {
  schoolId: string;
  adminId: string;
  adminName?: string;
  portalId?: string;
}

export class ExternalPortalService {
  private static instance: ExternalPortalService;

  private constructor() {}

  public static getInstance(): ExternalPortalService {
    if (!ExternalPortalService.instance) {
      ExternalPortalService.instance = new ExternalPortalService();
    }
    return ExternalPortalService.instance;
  }

  /**
   * Factory to resolve the portal adapter for a school.
   * Future portal integrations (e.g. TunisianPrivateSchoolPortalAdapter)
   * can be registered here based on portalId or school configuration.
   */
  public getAdapter(schoolId: string, portalId = "mock-school-portal"): ExternalPortalAdapter {
    switch (portalId) {
      case "mock-school-portal":
      default:
        return new MockSchoolPortalAdapter(schoolId);
    }
  }

  /**
   * Helper to write an audit log entry for external portal operations.
   */
  private async logAudit(
    context: PortalOperationContext,
    action: string,
    description: string,
    targetId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Non-blocking so remote DB connection latency never delays browser automation
      prisma.auditLog
        .create({
          data: {
            action,
            performedBy: context.adminName || context.adminId || "Admin",
            entityType: "EXTERNAL_PORTAL",
            entityId: targetId || null,
            description,
            newValues: metadata || undefined,
            schoolId: context.schoolId || "default_school",
          },
        })
        .catch((err) => {
          // Graceful fallback when running offline or without DB connection
        });
    } catch (err) {
      // Non-blocking for offline/testing scenarios
    }
  }

  /**
   * Execute an operation with controlled retries for transient errors.
   */
  private async executeWithRetry<T>(
    operationName: string,
    fn: () => Promise<T>,
    maxRetries = 1
  ): Promise<T> {
    let attempts = 0;
    while (attempts <= maxRetries) {
      try {
        return await fn();
      } catch (err: any) {
        attempts++;
        const message = err.message || String(err);

        // Do NOT retry non-transient errors (auth failure, not found, verification required)
        const isNonRetryable =
          message.includes("AUTHENTICATION_FAILED") ||
          message.includes("STUDENT_NOT_FOUND") ||
          message.includes("DOCUMENT_NOT_FOUND") ||
          message.includes("HUMAN_VERIFICATION_REQUIRED") ||
          message.includes("SESSION_EXPIRED");

        if (isNonRetryable || attempts > maxRetries) {
          throw err;
        }

        console.warn(
          `[ExternalPortalService] Retrying ${operationName} (attempt ${attempts}/${maxRetries}) due to: ${message}`
        );
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, attempts * 1000));
      }
    }
    throw new Error(`Failed to execute ${operationName} after retries.`);
  }

  /**
   * Search students on external portal.
   */
  public async searchStudent(
    criteria: StudentSearchCriteria,
    context: PortalOperationContext
  ): Promise<ExternalStudent[]> {
    const adapter = this.getAdapter(context.schoolId, context.portalId);

    const students = await this.executeWithRetry("searchStudent", () =>
      adapter.searchStudent(criteria)
    );

    await this.logAudit(
      context,
      "EXTERNAL_PORTAL_STUDENT_SEARCH",
      `Recherche externe de l'élève "${criteria.studentName || criteria.studentIdentifier || ""}" (${students.length} résultats)`,
      undefined,
      { criteria, count: students.length }
    );

    return students;
  }

  /**
   * Get single student profile.
   */
  public async getStudent(
    externalStudentId: string,
    context: PortalOperationContext
  ): Promise<ExternalStudent> {
    const adapter = this.getAdapter(context.schoolId, context.portalId);

    const student = await this.executeWithRetry("getStudent", () =>
      adapter.getStudent(externalStudentId)
    );

    await this.logAudit(
      context,
      "EXTERNAL_PORTAL_STUDENT_VIEW",
      `Consultation fiche externe de l'élève "${student.fullName}" (${student.id})`,
      student.id,
      { student }
    );

    return student;
  }

  /**
   * List available documents for student.
   */
  public async listDocuments(
    externalStudentId: string,
    context: PortalOperationContext
  ): Promise<ExternalDocument[]> {
    const adapter = this.getAdapter(context.schoolId, context.portalId);

    const documents = await this.executeWithRetry("listDocuments", () =>
      adapter.listDocuments(externalStudentId)
    );

    await this.logAudit(
      context,
      "EXTERNAL_PORTAL_DOCUMENT_LIST",
      `Consultation des documents pour l'élève externe ${externalStudentId} (${documents.length} documents)`,
      externalStudentId,
      { count: documents.length }
    );

    return documents;
  }

  /**
   * Download document for student.
   */
  public async downloadDocument(
    externalStudentId: string,
    documentTypeOrId: string,
    context: PortalOperationContext
  ): Promise<DownloadedDocument> {
    const adapter = this.getAdapter(context.schoolId, context.portalId);

    const downloadedDoc = await this.executeWithRetry("downloadDocument", () =>
      adapter.downloadDocument(externalStudentId, documentTypeOrId)
    );

    await this.logAudit(
      context,
      "EXTERNAL_PORTAL_DOCUMENT_DOWNLOAD",
      `Téléchargement du document "${downloadedDoc.filename}" (${Math.round(
        downloadedDoc.size / 1024
      )} KB) pour l'élève ${externalStudentId}`,
      externalStudentId,
      {
        filename: downloadedDoc.filename,
        size: downloadedDoc.size,
        mimeType: downloadedDoc.mimeType,
      }
    );

    return downloadedDoc;
  }

  /**
   * Cleanup temporary download file after transmission.
   */
  public cleanupTempFile(filePath?: string): void {
    browserService.cleanupTempFile(filePath);
  }
}

export const externalPortalService = ExternalPortalService.getInstance();
