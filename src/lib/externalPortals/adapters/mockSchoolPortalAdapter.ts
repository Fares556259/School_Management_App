/**
 * Mock School Portal Adapter
 *
 * Implements ExternalPortalAdapter using Playwright browser automation
 * against http://localhost:3001/test-school-portal.
 *
 * Encapsulates all portal-specific selectors, workflows, and edge case detection:
 * - Login & session validation
 * - Student search with homonym handling
 * - Profile and status inspection
 * - Document discovery & PDF downloading
 * - Session expiration & human verification detection
 */

import { Page } from "playwright";
import { browserService } from "@/lib/browser/browserService";
import {
  ExternalPortalAdapter,
  ExternalStudent,
  ExternalDocument,
  DownloadedDocument,
  StudentSearchCriteria,
} from "../types";

export class MockSchoolPortalAdapter implements ExternalPortalAdapter {
  readonly portalId = "mock-school-portal";
  readonly baseUrl: string;
  readonly schoolId: string;

  constructor(schoolId: string, baseUrl = "http://localhost:3001/test-school-portal") {
    this.schoolId = schoolId;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Helper to ensure valid session before proceeding with any action.
   */
  private async ensureAuthenticated(): Promise<void> {
    const isValid = await this.checkSession();
    if (!isValid) {
      await this.authenticate();
    }
  }

  /**
   * Authenticate with the mock school portal.
   */
  public async authenticate(credentials?: {
    username?: string;
    password?: string;
  }): Promise<void> {
    const username =
      credentials?.username || process.env.EXTERNAL_PORTAL_USER || "test-school";
    const password =
      credentials?.password || process.env.EXTERNAL_PORTAL_PASSWORD || "test-password";

    let page: Page | null = null;
    try {
      page = await browserService.createSafePage(this.schoolId);

      await page.goto(`${this.baseUrl}/login`, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      // If already redirected to dashboard, we are logged in
      if (page.url().includes("/dashboard")) {
        await browserService.saveSession(this.schoolId);
        return;
      }

      // Fill login form
      await page.fill("#username", username);
      await page.fill("#password", password);

      // Submit
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }),
        page.click("#login-btn"),
      ]);

      // Check for error
      if (page.url().includes("/login")) {
        const errorEl = await page.$("#login-error");
        if (errorEl) {
          const errorText = (await errorEl.textContent()) || "";
          throw new Error(`AUTHENTICATION_FAILED: ${errorText.trim()}`);
        }
      }

      // Persist authenticated session
      await browserService.saveSession(this.schoolId);
    } catch (err: any) {
      await browserService.captureFailure(page, this.schoolId, "authenticate");
      throw err;
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }

  /**
   * Verify if current session is active.
   */
  public async checkSession(): Promise<boolean> {
    let page: Page | null = null;
    try {
      page = await browserService.createSafePage(this.schoolId);
      await page.goto(`${this.baseUrl}/dashboard`, {
        waitUntil: "domcontentloaded",
        timeout: 8000,
      });

      if (page.url().includes("/login")) {
        return false;
      }

      const navStudents = await page.$("#nav-students");
      return !!navStudents;
    } catch {
      return false;
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }

  /**
   * Search students on portal by name, identifier, or class.
   */
  public async searchStudent(
    criteria: StudentSearchCriteria
  ): Promise<ExternalStudent[]> {
    await this.ensureAuthenticated();

    let page: Page | null = null;
    try {
      page = await browserService.createSafePage(this.schoolId);

      const queryTerm = criteria.studentName || criteria.studentIdentifier || "";
      const searchUrl = `${this.baseUrl}/students?q=${encodeURIComponent(queryTerm)}`;

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      // Detect session expiry redirect
      if (page.url().includes("/login")) {
        await browserService.clearSession(this.schoolId);
        throw new Error("SESSION_EXPIRED: La session a expiré. Veuillez vous reconnecter.");
      }

      // Parse table rows
      const rows = await page.$$("table.students-table tr.student-row");
      const students: ExternalStudent[] = [];

      for (const row of rows) {
        const id = ((await row.$eval(".student-id", (el) => el.textContent)) || "").trim();
        const fullName = (
          (await row.$eval(".student-name", (el) => el.textContent)) || ""
        ).trim();
        const className = (
          (await row.$eval(".student-class", (el) => el.textContent)) || ""
        ).trim();
        const statusText = (
          (await row.$eval(".student-status", (el) => el.textContent)) || ""
        ).trim();
        const regDate = (
          (await row.$eval(".student-reg-date", (el) => el.textContent)) || ""
        ).trim();

        const status = statusText.toLowerCase().includes("actif")
          ? "Active"
          : statusText.toLowerCase().includes("vérification")
          ? "Requires Verification"
          : "Inactive";

        students.push({
          id,
          fullName,
          className,
          status,
          registrationDate: regDate,
        });
      }

      // Filter by class if specified
      if (criteria.className) {
        const targetClass = criteria.className.toLowerCase().trim();
        return students.filter((s) => s.className.toLowerCase().includes(targetClass));
      }

      return students;
    } catch (err: any) {
      await browserService.captureFailure(page, this.schoolId, "searchStudent");
      throw err;
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }

  /**
   * Retrieve single student's complete profile.
   */
  public async getStudent(externalStudentId: string): Promise<ExternalStudent> {
    await this.ensureAuthenticated();

    let page: Page | null = null;
    try {
      page = await browserService.createSafePage(this.schoolId);

      const profileUrl = `${this.baseUrl}/students/${encodeURIComponent(externalStudentId)}`;
      const response = await page.goto(profileUrl, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      if (response && response.status() === 404) {
        throw new Error(
          `STUDENT_NOT_FOUND: L'élève '${externalStudentId}' est introuvable sur le portail.`
        );
      }

      // Check human verification banner
      const verificationWarning = await page.$("#human-verification-required");
      if (verificationWarning) {
        throw new Error(
          `HUMAN_VERIFICATION_REQUIRED: Vérification manuelle requise sur le portail pour l'élève '${externalStudentId}'.`
        );
      }

      const id = ((await page.$eval("#detail-student-id", (el) => el.textContent)) || "").trim();
      const fullName = (
        (await page.$eval("#detail-student-name", (el) => el.textContent)) || ""
      ).trim();
      const statusText = (
        (await page.$eval("#detail-student-status", (el) => el.textContent)) || ""
      ).trim();
      const classText = (
        (await page.$eval("#detail-student-class", (el) => el.textContent)) || ""
      ).trim();
      const className = classText.replace(/^Classe\s*:\s*/i, "").trim();

      const birthDate = (
        (await page.$eval("#detail-birth-date", (el) => el.textContent)) || ""
      ).trim();
      const registrationDate = (
        (await page.$eval("#detail-reg-date", (el) => el.textContent)) || ""
      ).trim();
      const parentName = (
        (await page.$eval("#detail-parent-name", (el) => el.textContent)) || ""
      ).trim();
      const parentPhone = (
        (await page.$eval("#detail-parent-phone", (el) => el.textContent)) || ""
      ).trim();

      return {
        id: id || externalStudentId,
        fullName,
        className,
        status: statusText.toLowerCase().includes("actif") ? "Active" : "Requires Verification",
        birthDate,
        registrationDate,
        parentName,
        parentPhone,
      };
    } catch (err: any) {
      await browserService.captureFailure(page, this.schoolId, "getStudent");
      throw err;
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }

  /**
   * List available documents for student.
   */
  public async listDocuments(externalStudentId: string): Promise<ExternalDocument[]> {
    await this.ensureAuthenticated();

    let page: Page | null = null;
    try {
      page = await browserService.createSafePage(this.schoolId);

      const docsUrl = `${this.baseUrl}/students/${encodeURIComponent(
        externalStudentId
      )}/documents`;
      const response = await page.goto(docsUrl, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      if (response && response.status() === 404) {
        throw new Error(
          `STUDENT_NOT_FOUND: L'élève '${externalStudentId}' est introuvable sur le portail.`
        );
      }

      const rows = await page.$$("table.documents-table tr.document-row");
      const docs: ExternalDocument[] = [];

      for (const row of rows) {
        const id = (await row.getAttribute("data-doc-id")) || "";
        const title = ((await row.$eval(".doc-title", (el) => el.textContent)) || "").trim();
        const type = ((await row.$eval(".doc-type", (el) => el.textContent)) || "").trim();
        const downloadBtn = await row.$(".download-doc-btn");

        docs.push({
          id,
          title,
          type,
          date: "2026-09-15",
          available: !!downloadBtn,
        });
      }

      return docs;
    } catch (err: any) {
      await browserService.captureFailure(page, this.schoolId, "listDocuments");
      throw err;
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }

  /**
   * Download specific document for a student.
   */
  public async downloadDocument(
    externalStudentId: string,
    documentTypeOrId: string
  ): Promise<DownloadedDocument> {
    await this.ensureAuthenticated();

    let page: Page | null = null;
    try {
      page = await browserService.createSafePage(this.schoolId);

      const docsUrl = `${this.baseUrl}/students/${encodeURIComponent(
        externalStudentId
      )}/documents`;
      await page.goto(docsUrl, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      // Find matching download button
      const normalizedQuery = documentTypeOrId.toLowerCase().trim();
      const rows = await page.$$("table.documents-table tr.document-row");

      let targetBtn: any = null;
      for (const row of rows) {
        const docId = ((await row.getAttribute("data-doc-id")) || "").toLowerCase();
        const title = (
          (await row.$eval(".doc-title", (el) => el.textContent)) || ""
        ).toLowerCase();
        const type = (
          (await row.$eval(".doc-type", (el) => el.textContent)) || ""
        ).toLowerCase();

        if (
          docId === normalizedQuery ||
          title.includes(normalizedQuery) ||
          type.includes(normalizedQuery) ||
          (normalizedQuery.includes("certificat") && title.includes("certificat")) ||
          (normalizedQuery.includes("inscription") && title.includes("inscription")) ||
          (normalizedQuery.includes("relev") && title.includes("relev"))
        ) {
          targetBtn = await row.$(".download-doc-btn");
          break;
        }
      }

      if (!targetBtn) {
        throw new Error(
          `DOCUMENT_NOT_FOUND: Le document '${documentTypeOrId}' n'est pas disponible pour cet élève.`
        );
      }

      // Trigger download and safely save
      const downloadedDoc = await browserService.handleDownload(page, this.schoolId, async () => {
        await targetBtn.click();
      });

      return downloadedDoc;
    } catch (err: any) {
      await browserService.captureFailure(page, this.schoolId, "downloadDocument");
      throw err;
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }

  public async close(): Promise<void> {
    // Context is retained in BrowserService for session reuse; no-op per execution
  }
}
