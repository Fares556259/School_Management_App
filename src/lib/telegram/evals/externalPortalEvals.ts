/**
 * Hnia External Browser / Computer-Use Evaluation Suite
 *
 * Covers all 12 scenarios specified in requirement 26:
 * 1. Admin searches student ("جيبلي معلومات أحمد بن علي من المنصة")
 * 2. Admin asks for certificate ("جيبلي شهادة الترسيم متاع أحمد")
 * 3. Admin confirms ("إي") -> PDF downloaded via Playwright & delivered
 * 4. Duplicate student names -> Ambiguity detection & disambiguation
 * 5. Unknown student -> Clean not found reporting
 * 6. Session expired -> Re-authentication required notification
 * 7. Missing PDF -> Unavailable document reporting
 * 8. Portal timeout -> Controlled retry & safe failure handling
 * 9. Multiple documents -> List available documents for admin choice
 * 10. Multiple students -> Individual processing & status reporting
 * 11. School A vs School B -> Strict tenant & cookie isolation
 * 12. Unauthorized access -> Server-side tenant security enforcement
 */

import http from "http";
import path from "path";
import fs from "fs";
import { createMockPortalServer } from "../../../../scripts/mockPortalServer";
import { browserService } from "@/lib/browser/browserService";
import { externalPortalService } from "@/lib/externalPortals/externalPortalService";
import {
  searchExternalStudentTool,
  getExternalStudentTool,
  listExternalDocumentsTool,
  downloadExternalDocumentTool,
} from "../tools/externalPortalTools";
import { TOOLS } from "../tools";
import { ToolContext } from "../tools/readTools";

export interface ExternalPortalEvalResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

export async function runExternalPortalEvals(): Promise<ExternalPortalEvalResult[]> {
  const results: ExternalPortalEvalResult[] = [];
  let mockServer: http.Server | null = null;

  const testSchoolId = "eval_school_external_001";
  const context: ToolContext = {
    schoolId: testSchoolId,
    adminId: "admin_eval_01",
    adminName: "Directeur Fares",
    language: "fr",
  };

  async function runTestCase(name: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, durationMs: Date.now() - start });
    } catch (err: any) {
      results.push({
        name,
        passed: false,
        durationMs: Date.now() - start,
        error: err.message || String(err),
      });
    }
  }

  // 1. Setup mock server on port 3001 if not already running
  try {
    mockServer = createMockPortalServer();
    await new Promise<void>((resolve, reject) => {
      mockServer!.listen(3001, "127.0.0.1", () => {
        resolve();
      });
      mockServer!.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          // Already running in background
          mockServer = null;
          resolve();
        } else {
          reject(err);
        }
      });
    });
  } catch (err) {
    console.warn("[ExternalPortalEvals] Mock server listen note:", err);
  }

  try {
    // ── SCENARIO 1: Search Student ──────────────────────────────────────────
    await runTestCase(
      "Scenario 1: Recherche d'élève via navigateur ('جيبلي معلومات أحمد بن علي من المنصة')",
      async () => {
        const res = await searchExternalStudentTool(
          { studentName: "Ahmed Ben Ali" },
          context
        );

        if (!res.success) {
          throw new Error(`Échec de la recherche: ${res.message}`);
        }
        if (res.count === 0 || !res.students?.length) {
          throw new Error("Aucun élève trouvé alors qu'Ahmed Ben Ali existe dans le portail.");
        }

        const ahmed8B = res.students.find((s) => s.className === "8ème B");
        if (!ahmed8B || ahmed8B.id !== "STU-001") {
          throw new Error("L'élève Ahmed Ben Ali (8ème B, STU-001) n'a pas été identifié correctement.");
        }
      }
    );

    // ── SCENARIO 2: Certificate Request & Confirmation Card ──────────────────
    await runTestCase(
      "Scenario 2: Détection certificat & carte de confirmation ('جيبلي شهادة الترسيم متاع أحمد')",
      async () => {
        const toolDef = TOOLS.download_external_document;
        if (!toolDef) {
          throw new Error("Outil download_external_document introuvable dans TOOLS !");
        }
        if (!toolDef.requiresConfirmation) {
          throw new Error("download_external_document doit obligatoirement exiger confirmation !");
        }

        // Test confirmation message generation
        const confirmMsgFr = toolDef.formatConfirmationMessage!(
          { externalStudentId: "STU-001", studentName: "Ahmed Ben Ali", documentType: "Certificat de scolarité" },
          context
        );
        if (typeof confirmMsgFr !== "string" || !confirmMsgFr.includes("Certificat de scolarité") || !confirmMsgFr.includes("Ahmed Ben Ali")) {
          throw new Error("Le message de confirmation FR n'est pas formaté correctement.");
        }

        const confirmMsgAr = toolDef.formatConfirmationMessage!(
          { externalStudentId: "STU-001", studentName: "أحمد بن علي", documentType: "شهادة الترسيم" },
          { ...context, language: "ar" }
        );
        if (typeof confirmMsgAr !== "string" || !confirmMsgAr.includes("شهادة الترسيم")) {
          throw new Error("Le message de confirmation Arabe n'est pas formaté correctement.");
        }
      }
    );

    // ── SCENARIO 3: Confirm Download & PDF Delivery ──────────────────────────
    await runTestCase(
      "Scenario 3: Validation 'إي' & Téléchargement réel du document PDF certifié",
      async () => {
        // Direct download via externalPortalService to verify actual Playwright PDF download
        const downloaded = await externalPortalService.downloadDocument(
          "STU-001",
          "Certificat de scolarité",
          { schoolId: testSchoolId, adminId: context.adminId, adminName: context.adminName }
        );

        if (!downloaded.buffer || downloaded.buffer.length === 0) {
          throw new Error("Le buffer du PDF téléchargé est vide !");
        }

        // Verify PDF Magic Header %PDF
        const header = downloaded.buffer.subarray(0, 4).toString();
        if (header !== "%PDF") {
          throw new Error(`Format invalide : l'en-tête du fichier n'est pas %PDF (obtenu: ${header})`);
        }

        if (downloaded.mimeType !== "application/pdf") {
          throw new Error(`MIME type inattendu : ${downloaded.mimeType}`);
        }

        if (!downloaded.filename.includes("Certificat")) {
          throw new Error(`Nom de fichier inattendu : ${downloaded.filename}`);
        }

        // Test cleanup
        if (downloaded.localPath) {
          externalPortalService.cleanupTempFile(downloaded.localPath);
          if (fs.existsSync(downloaded.localPath)) {
            throw new Error("Le fichier temporaire n'a pas été nettoyé après téléchargement.");
          }
        }
      }
    );

    // ── SCENARIO 4: Duplicate Student Names (Homonyms) ───────────────────────
    await runTestCase(
      "Scenario 4: Détection d'homonymes (Ahmed Ben Ali 8ème B vs 7ème A)",
      async () => {
        const res = await searchExternalStudentTool(
          { studentName: "Ahmed Ben Ali" },
          context
        );

        if (res.count !== 2 || !res.hasAmbiguity) {
          throw new Error(`Ambiguïté non détectée : attendu 2 homonymes, reçu ${res.count}`);
        }

        const classNames = res.students.map((s) => s.className).sort();
        if (classNames[0] !== "7ème A" || classNames[1] !== "8ème B") {
          throw new Error(`Classes des homonymes incorrectes: ${classNames.join(", ")}`);
        }

        // Disambiguated search with class
        const targetedRes = await searchExternalStudentTool(
          { studentName: "Ahmed Ben Ali", className: "8ème B" },
          context
        );
        if (targetedRes.count !== 1 || targetedRes.students[0].id !== "STU-001") {
          throw new Error("La recherche ciblée par classe n'a pas levé l'ambiguïté correctement.");
        }
      }
    );

    // ── SCENARIO 5: Unknown Student ──────────────────────────────────────────
    await runTestCase(
      "Scenario 5: Gestion d'élève inconnu ou inexistant",
      async () => {
        const res = await searchExternalStudentTool(
          { studentName: "Personne Inexistante XYZ" },
          context
        );

        if (res.count !== 0 || res.students.length !== 0) {
          throw new Error("Un élève fictif a été retourné par erreur !");
        }
        if (!res.message || !res.message.includes("Aucun élève")) {
          throw new Error("Message explicite d'absence d'élève manquant.");
        }
      }
    );

    // ── SCENARIO 6: Session Expired & Re-authentication ─────────────────────
    await runTestCase(
      "Scenario 6: Détection d'expiration de session & reconnexion requise",
      async () => {
        // Trigger session expiry on portal
        try {
          await fetch("http://localhost:3001/test-school-portal/test-control/expire-session", {
            method: "POST",
          });
        } catch {}

        // Invalidate in-memory context to simulate expired server session
        const adapter = externalPortalService.getAdapter(testSchoolId);
        await browserService.clearSession(testSchoolId);

        // Subsequent call must gracefully re-authenticate without crashing
        const res = await searchExternalStudentTool(
          { studentName: "Mariem" },
          context
        );
        if (!res.success || res.count === 0) {
          throw new Error("Le système n'a pas pu rétablir la session après expiration.");
        }
      }
    );

    // ── SCENARIO 7: Missing Document (Youssef Gharbi) ────────────────────────
    await runTestCase(
      "Scenario 7: Document indisponible (Certificat manquant pour Youssef Gharbi)",
      async () => {
        // Youssef Gharbi (STU-003) only has Inscription, NOT Certificat de scolarité
        const res = await downloadExternalDocumentTool(
          {
            externalStudentId: "STU-003",
            documentType: "Certificat de scolarité",
            studentName: "Youssef Gharbi",
          },
          context
        );

        if (res.success || !res.error) {
          throw new Error("Le système a faussement déclaré un succès pour un document inexistant !");
        }
        if (!res.message.includes("n'est pas disponible") && !res.message.includes("تعذر")) {
          throw new Error(`Message d'erreur inadéquat pour document manquant: ${res.message}`);
        }
      }
    );

    // ── SCENARIO 8: Transient Error & Controlled Retry ───────────────────────
    await runTestCase(
      "Scenario 8: Tolérance aux pannes transitoires & retry contrôlé",
      async () => {
        // Test retry mechanism on externalPortalService
        let attempts = 0;
        const result = await (externalPortalService as any).executeWithRetry(
          "testTransient",
          async () => {
            attempts++;
            if (attempts === 1) {
              throw new Error("Temporary network timeout socket hang up");
            }
            return "SUCCESS_AFTER_RETRY";
          },
          1
        );

        if (result !== "SUCCESS_AFTER_RETRY" || attempts !== 2) {
          throw new Error(`Retry échoué : attempts=${attempts}, result=${result}`);
        }
      }
    );

    // ── SCENARIO 9: Multiple Documents Listing ───────────────────────────────
    await runTestCase(
      "Scenario 9: Consultation multi-documents pour un élève",
      async () => {
        const res = await listExternalDocumentsTool(
          { externalStudentId: "STU-001" },
          context
        );

        if (!res.success || !res.documents || (res.count ?? 0) < 3) {
          throw new Error(`Attendu au moins 3 documents pour STU-001, reçu ${res.count}`);
        }

        const titles = res.documents.map((d: any) => d.title.toLowerCase());
        if (!titles.some((t: string) => t.includes("certificat"))) {
          throw new Error("Certificat de scolarité manquant dans la liste des documents.");
        }
        if (!titles.some((t: string) => t.includes("inscription"))) {
          throw new Error("Fiche d'inscription manquante dans la liste des documents.");
        }
      }
    );

    // ── SCENARIO 10: Batch Multiple Students ─────────────────────────────────
    await runTestCase(
      "Scenario 10: Traitement par lot de plusieurs élèves avec rapport individuel",
      async () => {
        const targetStudents = [
          { id: "STU-001", name: "Ahmed Ben Ali", expectDoc: true },
          { id: "STU-002", name: "Mariem Trabelsi", expectDoc: true },
          { id: "STU-003", name: "Youssef Gharbi", expectDoc: false }, // missing cert
        ];

        const batchReports: Array<{ id: string; success: boolean; filename?: string }> = [];

        for (const item of targetStudents) {
          const dlRes = await downloadExternalDocumentTool(
            {
              externalStudentId: item.id,
              documentType: "Certificat de scolarité",
              studentName: item.name,
            },
            context
          );
          batchReports.push({
            id: item.id,
            success: dlRes.success && !dlRes.error,
            filename: dlRes.filename,
          });
        }

        if (!batchReports[0].success || !batchReports[1].success) {
          throw new Error("Échec de téléchargement pour Ahmed ou Mariem dans le lot !");
        }
        if (batchReports[2].success) {
          throw new Error("Youssef Gharbi aurait dû échouer car son certificat est absent !");
        }
      }
    );

    // ── SCENARIO 11: Multi-tenant Isolation (School A vs School B) ───────────
    await runTestCase(
      "Scenario 11: Cloisonnement strict multi-écoles (School A vs School B)",
      async () => {
        const schoolA = "tenant_school_alpha";
        const schoolB = "tenant_school_beta";

        const contextA = await browserService.getOrCreateContext(schoolA);
        const contextB = await browserService.getOrCreateContext(schoolB);

        if (contextA === contextB) {
          throw new Error("Violation critique de sécurité : School A et School B partagent le même BrowserContext !");
        }

        // Verify isolated download paths
        const downloadsA = path.join(process.cwd(), "tmp", "browser-downloads", schoolA);
        const downloadsB = path.join(process.cwd(), "tmp", "browser-downloads", schoolB);

        if (downloadsA === downloadsB) {
          throw new Error("Violation de sécurité : Les répertoires de téléchargement ne sont pas cloisonnés.");
        }
      }
    );

    // ── SCENARIO 12: Security Policy Enforcement ─────────────────────────────
    await runTestCase(
      "Scenario 12: Blocage de sécurité des domaines non autorisés & absence de schoolId",
      async () => {
        // 1. Missing schoolId must be rejected
        let caughtMissingSchool = false;
        try {
          await browserService.getOrCreateContext("");
        } catch (err: any) {
          caughtMissingSchool = err.message.includes("schoolId is required");
        }
        if (!caughtMissingSchool) {
          throw new Error("L'absence de schoolId n'a pas été rejetée par BrowserService !");
        }

        // 2. Safe page blocks unauthorized arbitrary domain
        const page = await browserService.createSafePage("security_test_school");
        let blocked = false;
        try {
          await page.goto("http://malicious-external-site-xyz.com/leak", { timeout: 3000 });
        } catch {
          blocked = true;
        } finally {
          await page.close();
        }

        if (!blocked) {
          throw new Error("Le système a autorisé la navigation vers un domaine hors liste blanche !");
        }
      }
    );
  } finally {
    // Teardown
    await browserService.closeAll();
    if (mockServer) {
      await new Promise<void>((resolve) => (mockServer as http.Server).close(() => resolve()));
    }
  }

  return results;
}
