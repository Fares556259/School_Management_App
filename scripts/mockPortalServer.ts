/**
 * Standalone Mock External School Portal Server
 * Runs at http://localhost:3001/test-school-portal
 *
 * Simulates a realistic Tunisian private-school / government portal:
 * - Login with session cookies
 * - Dashboard
 * - Students list with search, pagination, and status
 * - Student detail view
 * - Documents section with dynamic PDF generation (jsPDF)
 * - Homonym student records (Ahmed Ben Ali in 8ème B vs 7ème A)
 * - Session expiry & controlled test endpoints
 */

import http from "http";
import url from "url";
import querystring from "querystring";
import { jsPDF } from "jspdf";

const PORT = 3001;
const BASE_PATH = "/test-school-portal";

// In-memory session store: token -> { school: string, expiresAt: number }
const activeSessions = new Map<string, { username: string; expiresAt: number }>();

// Seed student records
interface MockStudent {
  id: string;
  fullName: string;
  className: string;
  status: "Active" | "Inactive" | "Requires Verification";
  birthDate: string;
  registrationDate: string;
  parentName: string;
  parentPhone: string;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    filename: string;
  }>;
}

const MOCK_STUDENTS: MockStudent[] = [
  {
    id: "STU-001",
    fullName: "Ahmed Ben Ali",
    className: "8ème B",
    status: "Active",
    birthDate: "2012-03-15",
    registrationDate: "2026-09-15",
    parentName: "Moncef Ben Ali",
    parentPhone: "+216 98 123 456",
    documents: [
      {
        id: "doc-001",
        title: "Certificat de scolarité",
        type: "CERTIFICAT_SCOLARITE",
        filename: "Ahmed_Ben_Ali_Certificat_de_scolarite.pdf",
      },
      {
        id: "doc-002",
        title: "Fiche d'inscription",
        type: "INSCRIPTION",
        filename: "Ahmed_Ben_Ali_Inscription.pdf",
      },
      {
        id: "doc-003",
        title: "Relevé de notes",
        type: "RELEVE_NOTES",
        filename: "Ahmed_Ben_Ali_Releve.pdf",
      },
    ],
  },
  {
    id: "STU-002",
    fullName: "Mariem Trabelsi",
    className: "7ème A",
    status: "Active",
    birthDate: "2013-08-22",
    registrationDate: "2026-09-15",
    parentName: "Sami Trabelsi",
    parentPhone: "+216 22 345 678",
    documents: [
      {
        id: "doc-004",
        title: "Certificat de scolarité",
        type: "CERTIFICAT_SCOLARITE",
        filename: "Mariem_Trabelsi_Certificat_de_scolarite.pdf",
      },
      {
        id: "doc-005",
        title: "Fiche d'inscription",
        type: "INSCRIPTION",
        filename: "Mariem_Trabelsi_Inscription.pdf",
      },
    ],
  },
  {
    id: "STU-003",
    fullName: "Youssef Gharbi",
    className: "9ème",
    status: "Active",
    birthDate: "2011-11-04",
    registrationDate: "2026-09-15",
    parentName: "Nabil Gharbi",
    parentPhone: "+216 55 987 654",
    // Note: Youssef is missing "Certificat de scolarité" on purpose to test Test 7
    documents: [
      {
        id: "doc-006",
        title: "Fiche d'inscription",
        type: "INSCRIPTION",
        filename: "Youssef_Gharbi_Inscription.pdf",
      },
    ],
  },
  {
    id: "STU-004",
    fullName: "Sara Ben Salem",
    className: "8ème A",
    status: "Requires Verification",
    birthDate: "2012-07-19",
    registrationDate: "2026-09-15",
    parentName: "Karim Ben Salem",
    parentPhone: "+216 99 444 333",
    documents: [],
  },
  {
    id: "STU-005",
    fullName: "Ahmed Ben Ali",
    className: "7ème A",
    status: "Active",
    birthDate: "2013-05-20",
    registrationDate: "2026-09-15",
    parentName: "Tarek Ben Ali",
    parentPhone: "+216 29 888 777",
    documents: [
      {
        id: "doc-007",
        title: "Certificat de scolarité",
        type: "CERTIFICAT_SCOLARITE",
        filename: "Ahmed_Ben_Ali_7A_Certificat_de_scolarite.pdf",
      },
      {
        id: "doc-008",
        title: "Fiche d'inscription",
        type: "INSCRIPTION",
        filename: "Ahmed_Ben_Ali_7A_Inscription.pdf",
      },
    ],
  },
];

// PDF Generator helper using jsPDF
function generateStudentPdf(
  student: MockStudent,
  documentTitle: string,
  docType: string
): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header styling
  doc.setFillColor(30, 58, 138); // Deep primary navy
  doc.rect(0, 0, 210, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RÉPUBLIQUE TUNISIENNE - MINISTÈRE DE L'ÉDUCATION", 105, 12, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("PORTAIL OFFICIEL DES ÉTABLISSEMENTS SCOLAIRES PRIVÉS", 105, 20, {
    align: "center",
  });

  // Document Title
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(documentTitle.toUpperCase(), 105, 48, { align: "center" });

  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.8);
  doc.line(40, 52, 170, 52);

  // Student details box
  doc.setDrawColor(209, 213, 219);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(20, 60, 170, 75, 3, 3, "FD");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55, 65, 81);
  doc.text("INFORMATIONS DE L'ÉLÈVE", 26, 70);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(17, 24, 39);
  doc.text(`Identifiant National / ID : ${student.id}`, 26, 80);
  doc.text(`Nom et Prénom : ${student.fullName}`, 26, 88);
  doc.text(`Classe Fréquentée : ${student.className}`, 26, 96);
  doc.text(`Date de Naissance : ${student.birthDate}`, 26, 104);
  doc.text(`Date d'Inscription : ${student.registrationDate}`, 26, 112);
  doc.text(`Parent / Tuteur Légal : ${student.parentName} (${student.parentPhone})`, 26, 120);
  doc.text(`Statut Administratif : ${student.status.toUpperCase()}`, 26, 128);

  // Certification text
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Nous attestons par la présente que l'élève mentionné(e) ci-dessus est régulièrement",
    20,
    150
  );
  doc.text(
    `inscrit(e) au sein de notre établissement pour l'année scolaire 2026/2027 en classe de ${student.className}.`,
    20,
    157
  );
  doc.text(
    "La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.",
    20,
    166
  );

  // Official Stamp Box
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.5);
  doc.rect(120, 185, 65, 35);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("RÉPUBLIQUE TUNISIENNE", 152.5, 192, { align: "center" });
  doc.text("SIGNATURE & CACHET OFFICIEL", 152.5, 198, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("Document certifié conforme", 152.5, 205, { align: "center" });
  doc.text("Délivré le 15/09/2026", 152.5, 212, { align: "center" });

  // Footer
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Réf: PORTAL-${student.id}-${docType}-2026 | Document officiel généré par le portail central`,
    105,
    285,
    { align: "center" }
  );

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// Helper to parse cookies
function parseCookies(req: http.IncomingMessage): Record<string, string> {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    list[parts.shift()!.trim()] = decodeURI(parts.join("="));
  });
  return list;
}

// HTML Shell Layout
function renderHtml(title: string, bodyContent: string, isLoggedIn = true): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Portail Scolaire Officiel</title>
  <style>
    :root {
      --primary: #1e3a8a;
      --primary-hover: #1d4ed8;
      --surface: #ffffff;
      --bg: #f8fafc;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --success: #16a34a;
      --danger: #dc2626;
      --warning: #d97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); line-height: 1.5; min-height: 100vh; }
    header { background: var(--primary); color: #fff; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.06); }
    header .brand { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em; display: flex; align-items: center; gap: 10px; }
    header .brand span { font-size: 0.85rem; font-weight: normal; opacity: 0.85; }
    header nav a { color: #e2e8f0; text-decoration: none; font-size: 0.9rem; margin-left: 18px; font-weight: 500; }
    header nav a:hover { color: #fff; }
    .container { max-width: 1080px; margin: 32px auto; padding: 0 20px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 24px; }
    h1, h2, h3 { color: #1e293b; }
    .btn { display: inline-flex; align-items: center; justify-content: center; background: var(--primary); color: #fff; padding: 9px 18px; border-radius: 6px; font-size: 0.9rem; font-weight: 500; text-decoration: none; border: none; cursor: pointer; transition: background 0.15s ease; }
    .btn:hover { background: var(--primary-hover); }
    .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid var(--border); }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-danger { background: var(--danger); }
    .btn-sm { padding: 6px 12px; font-size: 0.825rem; }
    input[type="text"], input[type="password"] { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.95rem; margin-top: 6px; margin-bottom: 16px; outline: none; }
    input[type="text"]:focus, input[type="password"]:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(30,58,138,0.15); }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.9rem; }
    th { text-align: left; background: #f8fafc; padding: 12px 16px; border-bottom: 2px solid var(--border); color: #475569; font-weight: 600; }
    td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:hover td { background: #f8fafc; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .alert { padding: 12px 16px; border-radius: 6px; margin-bottom: 18px; font-size: 0.9rem; }
    .alert-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .alert-warning { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      🏫 Portail Établissement Scolaire
      <span>(Ministère de l'Éducation)</span>
    </div>
    ${
      isLoggedIn
        ? `<nav>
        <a href="${BASE_PATH}/dashboard" id="nav-dashboard">Tableau de bord</a>
        <a href="${BASE_PATH}/students" id="nav-students">Élèves</a>
        <a href="${BASE_PATH}/logout" id="nav-logout">Déconnexion</a>
      </nav>`
        : ""
    }
  </header>
  <div class="container">
    ${bodyContent}
  </div>
</body>
</html>`;
}

// Request dispatcher
export function createMockPortalServer(): http.Server {
  return http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || "", true);
    const pathname = parsedUrl.pathname || "";
    const method = req.method || "GET";

    // Normalize path
    if (pathname === "/" || pathname === BASE_PATH || pathname === `${BASE_PATH}/`) {
      res.writeHead(302, { Location: `${BASE_PATH}/login` });
      return res.end();
    }

    const cookies = parseCookies(req);
    const sessionToken = cookies["portal_session"];
    const session = sessionToken ? activeSessions.get(sessionToken) : null;
    const isSessionValid = session && session.expiresAt > Date.now();

    // ── 1. LOGIN GET ──────────────────────────────────────────────────────────
    if (pathname === `${BASE_PATH}/login` && method === "GET") {
      if (isSessionValid) {
        res.writeHead(302, { Location: `${BASE_PATH}/dashboard` });
        return res.end();
      }

      const hasError = parsedUrl.query.error === "invalid_credentials";
      const hasExpired = parsedUrl.query.expired === "1";

      const html = renderHtml(
        "Connexion Administrative",
        `
        <div style="max-width: 420px; margin: 40px auto;">
          <div class="card">
            <h2 style="margin-bottom: 8px; font-size: 1.35rem;">Connexion Établissement</h2>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 20px;">
              Accès sécurisé au portail administratif de l'établissement scolaire.
            </p>

            ${
              hasError
                ? `<div class="alert alert-danger" id="login-error">Identifiant ou mot de passe incorrect.</div>`
                : ""
            }
            ${
              hasExpired
                ? `<div class="alert alert-warning" id="session-expired-msg">Votre session a expiré. Veuillez vous reconnecter.</div>`
                : ""
            }

            <form method="POST" action="${BASE_PATH}/login" id="login-form">
              <label for="username" style="font-weight: 600; font-size: 0.875rem;">Identifiant Établissement</label>
              <input type="text" id="username" name="username" placeholder="test-school" required autocomplete="username" />

              <label for="password" style="font-weight: 600; font-size: 0.875rem;">Mot de passe</label>
              <input type="password" id="password" name="password" placeholder="••••••••" required autocomplete="current-password" />

              <button type="submit" id="login-btn" class="btn" style="width: 100%;">
                Se connecter au portail
              </button>
            </form>
          </div>
        </div>
      `,
        false
      );

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    // ── 2. LOGIN POST ─────────────────────────────────────────────────────────
    if (pathname === `${BASE_PATH}/login` && method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const formData = querystring.parse(body);
        const username = formData.username as string;
        const password = formData.password as string;

        const expectedUser = process.env.EXTERNAL_PORTAL_USER || "test-school";
        const expectedPass = process.env.EXTERNAL_PORTAL_PASSWORD || "test-password";

        if (username === expectedUser && password === expectedPass) {
          const token = `session_${Math.random().toString(36).substring(2)}_${Date.now()}`;
          // 2-hour session
          activeSessions.set(token, {
            username,
            expiresAt: Date.now() + 2 * 60 * 60 * 1000,
          });

          res.writeHead(302, {
            Location: `${BASE_PATH}/dashboard`,
            "Set-Cookie": `portal_session=${token}; Path=${BASE_PATH}; HttpOnly; SameSite=Lax`,
          });
          return res.end();
        } else {
          res.writeHead(302, {
            Location: `${BASE_PATH}/login?error=invalid_credentials`,
          });
          return res.end();
        }
      });
      return;
    }

    // ── 3. LOGOUT GET ─────────────────────────────────────────────────────────
    if (pathname === `${BASE_PATH}/logout` && method === "GET") {
      if (sessionToken) {
        activeSessions.delete(sessionToken);
      }
      res.writeHead(302, {
        Location: `${BASE_PATH}/login`,
        "Set-Cookie": `portal_session=; Path=${BASE_PATH}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      });
      return res.end();
    }

    // ── TEST CONTROL: EXPIRE SESSION ──────────────────────────────────────────
    if (pathname === `${BASE_PATH}/test-control/expire-session`) {
      if (sessionToken && activeSessions.has(sessionToken)) {
        activeSessions.set(sessionToken, { username: "expired", expiresAt: Date.now() - 1000 });
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, message: "Current session marked expired" }));
    }

    // ── TEST CONTROL: TIMEOUT ─────────────────────────────────────────────────
    if (pathname === `${BASE_PATH}/test-control/timeout`) {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, delayed: true }));
      }, 35000);
      return;
    }

    // Auth guard for protected routes
    if (!isSessionValid) {
      res.writeHead(302, { Location: `${BASE_PATH}/login?expired=1` });
      return res.end();
    }

    // ── 4. DASHBOARD GET ──────────────────────────────────────────────────────
    if (pathname === `${BASE_PATH}/dashboard` && method === "GET") {
      const html = renderHtml(
        "Tableau de bord Établissement",
        `
        <div class="card">
          <h2 style="font-size: 1.4rem; margin-bottom: 4px;">Tableau de Bord Administratif</h2>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px;">
            Année scolaire 2026 - 2027 | Établissement agréé
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px;">
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 18px; border-radius: 8px;">
              <div style="font-size: 0.85rem; color: #1e40af; font-weight: 600;">ÉLÈVES ENREGISTRÉS</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: #1e3a8a; margin-top: 4px;">${MOCK_STUDENTS.length}</div>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 18px; border-radius: 8px;">
              <div style="font-size: 0.85rem; color: #166534; font-weight: 600;">DOCUMENTS DISPONIBLES</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: #14532d; margin-top: 4px;">12</div>
            </div>
            <div style="background: #fdf4ff; border: 1px solid #f5d0fe; padding: 18px; border-radius: 8px;">
              <div style="font-size: 0.85rem; color: #86198f; font-weight: 600;">CLASSES HOMOLOGUÉES</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: #701a75; margin-top: 4px;">6</div>
            </div>
          </div>

          <div style="display: flex; gap: 12px;">
            <a href="${BASE_PATH}/students" id="btn-goto-students" class="btn">
              Accéder au Répertoire des Élèves &rarr;
            </a>
          </div>
        </div>
      `
      );

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    // ── 5. STUDENTS LIST GET ──────────────────────────────────────────────────
    if (pathname === `${BASE_PATH}/students` && method === "GET") {
      const searchQuery = ((parsedUrl.query.q as string) || "").trim().toLowerCase();

      const filtered = MOCK_STUDENTS.filter((s) => {
        if (!searchQuery) return true;
        return (
          s.fullName.toLowerCase().includes(searchQuery) ||
          s.id.toLowerCase().includes(searchQuery) ||
          s.className.toLowerCase().includes(searchQuery)
        );
      });

      const rows = filtered
        .map((s) => {
          const statusBadge =
            s.status === "Active"
              ? `<span class="badge badge-active">Actif</span>`
              : s.status === "Requires Verification"
              ? `<span class="badge badge-danger">Vérification Requise</span>`
              : `<span class="badge badge-warning">Inactif</span>`;

          return `
          <tr class="student-row" data-student-id="${s.id}">
            <td class="student-id" style="font-family: monospace; font-weight: 600;">${s.id}</td>
            <td class="student-name">
              <strong>${s.fullName}</strong>
            </td>
            <td class="student-class">${s.className}</td>
            <td class="student-status">${statusBadge}</td>
            <td class="student-reg-date">${s.registrationDate}</td>
            <td>
              <a href="${BASE_PATH}/students/${s.id}" class="btn btn-secondary btn-sm view-student-btn" id="view-student-${s.id}">
                Consulter Fiche
              </a>
              <a href="${BASE_PATH}/students/${s.id}/documents" class="btn btn-sm docs-student-btn" id="docs-student-${s.id}" style="margin-left: 6px;">
                Documents
              </a>
            </td>
          </tr>
        `;
        })
        .join("");

      const html = renderHtml(
        "Répertoire des Élèves",
        `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h2 style="font-size: 1.35rem;">Répertoire Officiel des Élèves</h2>
              <p style="color: var(--text-muted); font-size: 0.875rem;">Recherchez un élève par nom, identifiant ou classe.</p>
            </div>
            <div style="font-size: 0.875rem; color: var(--text-muted);">
              Résultats trouvés : <strong id="student-count">${filtered.length}</strong>
            </div>
          </div>

          <form method="GET" action="${BASE_PATH}/students" id="search-form" style="display: flex; gap: 10px; margin-bottom: 20px;">
            <input
              type="text"
              id="search-input"
              name="q"
              placeholder="Rechercher par nom (ex: Ahmed Ben Ali) ou ID..."
              value="${parsedUrl.query.q || ""}"
              style="margin-bottom: 0; flex: 1;"
            />
            <button type="submit" id="search-btn" class="btn">
              Rechercher
            </button>
            ${
              searchQuery
                ? `<a href="${BASE_PATH}/students" class="btn btn-secondary" id="clear-search-btn">Effacer</a>`
                : ""
            }
          </form>

          <table class="students-table" id="students-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom & Prénom</th>
                <th>Classe</th>
                <th>Statut</th>
                <th>Date d'Inscription</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows ||
                `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;" id="no-students-msg">Aucun élève correspondant trouvé.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      `
      );

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    // ── 6. STUDENT DETAIL GET ─────────────────────────────────────────────────
    const studentDetailMatch = pathname.match(new RegExp(`^${BASE_PATH}/students/([^/]+)$`));
    if (studentDetailMatch && method === "GET") {
      const studentId = studentDetailMatch[1];
      const student = MOCK_STUDENTS.find((s) => s.id === studentId);

      if (!student) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(
          renderHtml(
            "Élève Introuvable",
            `<div class="card"><h2 style="color: var(--danger);">404 - Élève non trouvé</h2><p>L'identifiant ${studentId} ne correspond à aucun enregistrement.</p><a href="${BASE_PATH}/students" class="btn" style="margin-top: 16px;">Retour aux élèves</a></div>`
          )
        );
      }

      // Check if student requires verification
      const verificationWarning =
        student.status === "Requires Verification"
          ? `<div class="alert alert-danger" id="human-verification-required">
            ⚠️ <strong>Vérification Manuelle Requise</strong> : Le profil de cet élève est temporairement suspendu en attente de vérification d'identité physique auprès de l'administration.
          </div>`
          : "";

      const html = renderHtml(
        `Fiche Élève - ${student.fullName}`,
        `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div>
              <div style="font-size: 0.825rem; font-family: monospace; color: var(--text-muted);" id="detail-student-id">${student.id}</div>
              <h2 style="font-size: 1.5rem; margin-top: 4px;" id="detail-student-name">${student.fullName}</h2>
              <div style="margin-top: 6px;">
                <span class="badge ${student.status === "Active" ? "badge-active" : "badge-danger"}" id="detail-student-status">
                  ${student.status}
                </span>
                <span style="margin-left: 8px; font-weight: 600; color: #475569;" id="detail-student-class">
                  Classe : ${student.className}
                </span>
              </div>
            </div>
            <div>
              <a href="${BASE_PATH}/students/${student.id}/documents" class="btn" id="btn-student-docs">
                📄 Consulter Documents (${student.documents.length})
              </a>
            </div>
          </div>

          ${verificationWarning}

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 1px solid var(--border); padding-top: 20px; font-size: 0.95rem;">
            <div>
              <div style="color: var(--text-muted); font-size: 0.825rem;">Date de Naissance</div>
              <div style="font-weight: 500; margin-top: 2px;" id="detail-birth-date">${student.birthDate}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.825rem;">Date d'Inscription</div>
              <div style="font-weight: 500; margin-top: 2px;" id="detail-reg-date">${student.registrationDate}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.825rem;">Tuteur / Parent Légal</div>
              <div style="font-weight: 500; margin-top: 2px;" id="detail-parent-name">${student.parentName}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.825rem;">Contact Téléphonique</div>
              <div style="font-weight: 500; margin-top: 2px;" id="detail-parent-phone">${student.parentPhone}</div>
            </div>
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
            <a href="${BASE_PATH}/students" class="btn btn-secondary btn-sm" id="btn-back-students">&larr; Retour à la liste</a>
          </div>
        </div>
      `
      );

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    // ── 7. STUDENT DOCUMENTS LIST GET ─────────────────────────────────────────
    const studentDocsMatch = pathname.match(
      new RegExp(`^${BASE_PATH}/students/([^/]+)/documents$`)
    );
    if (studentDocsMatch && method === "GET") {
      const studentId = studentDocsMatch[1];
      const student = MOCK_STUDENTS.find((s) => s.id === studentId);

      if (!student) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderHtml("Élève Introuvable", "<p>Élève non trouvé.</p>"));
      }

      const docRows = student.documents
        .map(
          (doc) => `
        <tr class="document-row" data-doc-id="${doc.id}">
          <td class="doc-title" style="font-weight: 600;">${doc.title}</td>
          <td class="doc-type"><code style="font-size: 0.8rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${doc.type}</code></td>
          <td class="doc-filename">${doc.filename}</td>
          <td class="doc-status"><span class="badge badge-active">Disponible</span></td>
          <td>
            <a
              href="${BASE_PATH}/students/${student.id}/documents/${doc.id}/download"
              class="btn btn-sm download-doc-btn"
              id="download-doc-${doc.id}"
              data-doc-id="${doc.id}"
              data-doc-type="${doc.type}"
              data-filename="${doc.filename}"
              download="${doc.filename}"
            >
              📥 Télécharger PDF
            </a>
          </td>
        </tr>
      `
        )
        .join("");

      const html = renderHtml(
        `Documents Officiels - ${student.fullName}`,
        `
        <div class="card">
          <div style="margin-bottom: 20px;">
            <div style="font-size: 0.825rem; font-family: monospace; color: var(--text-muted);">${student.id} &bull; Classe: ${student.className}</div>
            <h2 style="font-size: 1.4rem; margin-top: 4px;" id="documents-student-name">Documents Officiels de ${student.fullName}</h2>
            <p style="color: var(--text-muted); font-size: 0.875rem;">Téléchargez les attestations et documents certifiés en format PDF.</p>
          </div>

          <table class="documents-table" id="documents-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type Administratif</th>
                <th>Nom du Fichier</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${
                docRows ||
                `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;" id="no-docs-msg">Aucun document disponible pour cet élève.</td></tr>`
              }
            </tbody>
          </table>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
            <a href="${BASE_PATH}/students/${student.id}" class="btn btn-secondary btn-sm" id="btn-back-profile">&larr; Retour à la fiche élève</a>
          </div>
        </div>
      `
      );

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    // ── 8. STUDENT DOCUMENT DOWNLOAD GET ──────────────────────────────────────
    const downloadMatch = pathname.match(
      new RegExp(`^${BASE_PATH}/students/([^/]+)/documents/([^/]+)/download$`)
    );
    if (downloadMatch && method === "GET") {
      const studentId = downloadMatch[1];
      const docId = downloadMatch[2];

      const student = MOCK_STUDENTS.find((s) => s.id === studentId);
      if (!student) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Student not found");
      }

      const documentItem = student.documents.find((d) => d.id === docId);
      if (!documentItem) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Document not found");
      }

      const pdfBuffer = generateStudentPdf(student, documentItem.title, documentItem.type);

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${documentItem.filename}"`,
        "Content-Length": pdfBuffer.length,
      });
      return res.end(pdfBuffer);
    }

    // 404 Fallback
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderHtml("Page Non Trouvée", "<h2>404 - Page non trouvée</h2>"));
  });
}

// Standalone runner if invoked directly
if (require.main === module) {
  const server = createMockPortalServer();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`=================================================`);
    console.log(`🏫 Mock External School Portal is RUNNING`);
    console.log(`🔗 URL: http://localhost:${PORT}${BASE_PATH}`);
    console.log(`👤 User: test-school | 🔑 Pass: test-password`);
    console.log(`=================================================`);
  });
}
