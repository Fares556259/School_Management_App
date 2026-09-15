/**
 * Types and Interfaces for External School Portals
 */

export interface ExternalStudent {
  id: string; // e.g. "STU-001"
  fullName: string; // e.g. "Ahmed Ben Ali"
  className: string; // e.g. "8ème B"
  status: "Active" | "Inactive" | "Requires Verification";
  birthDate?: string; // e.g. "2012-03-15"
  registrationDate?: string; // e.g. "2026-09-15"
  nationalId?: string;
  parentName?: string;
  parentPhone?: string;
}

export interface ExternalDocument {
  id: string; // e.g. "doc-cert-001"
  title: string; // e.g. "Certificat de scolarité"
  type: string; // e.g. "CERTIFICAT_SCOLARITE", "INSCRIPTION", "RELEVE_NOTES"
  date: string; // e.g. "2026-09-15"
  available: boolean;
  downloadUrl?: string;
}

export interface DownloadedDocument {
  filename: string; // e.g. "Ahmed_Ben_Ali_Certificat_de_scolarite.pdf"
  mimeType: string; // e.g. "application/pdf"
  buffer: Buffer;
  size: number;
  localPath?: string;
}

export interface StudentSearchCriteria {
  studentName?: string;
  studentIdentifier?: string;
  className?: string;
}

export type PortalAuthStatus =
  | "authenticated"
  | "unauthenticated"
  | "session_expired"
  | "needs_human_verification"
  | "invalid_credentials";

export interface PortalSessionInfo {
  schoolId: string;
  portalId: string;
  status: PortalAuthStatus;
  lastAuthenticatedAt?: Date;
  expiresAt?: Date;
}

/**
 * Standard contract for any external school/government portal adapter.
 * Implementation isolates website-specific workflows and DOM selectors.
 */
export interface ExternalPortalAdapter {
  readonly portalId: string;
  readonly baseUrl: string;

  /**
   * Authenticate into the external portal (or verify existing valid session).
   */
  authenticate(credentials?: { username?: string; password?: string }): Promise<void>;

  /**
   * Check if current session cookie/state is still valid.
   */
  checkSession(): Promise<boolean>;

  /**
   * Search students on the portal by name, identifier, or class.
   */
  searchStudent(criteria: StudentSearchCriteria): Promise<ExternalStudent[]>;

  /**
   * Fetch full student profile by external student ID.
   */
  getStudent(externalStudentId: string): Promise<ExternalStudent>;

  /**
   * List available documents for an external student.
   */
  listDocuments(externalStudentId: string): Promise<ExternalDocument[]>;

  /**
   * Download a specific document for a student.
   */
  downloadDocument(
    externalStudentId: string,
    documentTypeOrId: string
  ): Promise<DownloadedDocument>;

  /**
   * Graceful cleanup of any open pages/context for this adapter run.
   */
  close(): Promise<void>;
}
