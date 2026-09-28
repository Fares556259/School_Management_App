import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateMobileRequest(request);
    if (auth.error) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"><title>Non autorisé</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h2>⚠️ Session expirée ou non autorisée</h2>
          <p>Veuillez réouvrir l'application SnapSchool.</p>
        </body>
        </html>`,
        { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const { userType, schoolId } = auth.payload;
    if (userType !== "admin") {
      return new NextResponse("Accès réservé à la direction", { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const tokenParam = searchParams.get("token") || "";

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    const schoolName = school?.name || "SnapSchool";

    const [incomesToday, expensesToday, paymentsToday] = await Promise.all([
      prisma.income.findMany({
        where: {
          schoolId,
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: "asc" },
      }),
      prisma.expense.findMany({
        where: {
          schoolId,
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: "asc" },
      }),
      prisma.payment.findMany({
        where: {
          schoolId,
          paidAt: { gte: startOfDay, lte: endOfDay },
          userType: "STUDENT",
        },
        include: {
          student: {
            select: { name: true, surname: true, class: { select: { name: true } } },
          },
        },
        orderBy: { paidAt: "asc" },
      }),
    ]);

    // Build inflow items
    const inflowItems: Array<{
      time: string;
      label: string;
      categoryOrClass: string;
      method: string;
      checkDetails?: string;
      amount: number;
    }> = [];

    const recordedIncomeRefIds = new Set(
      incomesToday.map((inc) => inc.referenceId).filter(Boolean)
    );

    for (const inc of incomesToday) {
      const isCheck = inc.title.toLowerCase().includes("chèque") || inc.title.toLowerCase().includes("cheque");
      const isTransfer = inc.title.toLowerCase().includes("virement") || inc.category.toLowerCase().includes("transfer");
      const method = isCheck ? "Chèque" : isTransfer ? "Virement" : "Espèces";

      const checkMatch = inc.title.match(/ch[eè]que\s*(?:n[°o]?)?\s*([0-9a-zA-Z_-]+)/i);
      const checkDetails = checkMatch ? checkMatch[1] : undefined;

      inflowItems.push({
        time: inc.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        label: inc.title,
        categoryOrClass: inc.category,
        method,
        checkDetails,
        amount: inc.amount,
      });
    }

    for (const pmt of paymentsToday) {
      if (recordedIncomeRefIds.has(pmt.id.toString())) continue;
      const studentName = pmt.student ? `${pmt.student.name} ${pmt.student.surname}` : "Élève";
      const className = pmt.student?.class?.name || "Sans classe";
      const time = pmt.paidAt ? pmt.paidAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

      inflowItems.push({
        time,
        label: `Scolarité : ${studentName}`,
        categoryOrClass: className,
        method: "Espèces",
        amount: pmt.amount,
      });
    }

    // Build outflow items
    const outflowItems = expensesToday.map((exp) => {
      const isTransfer = exp.title.toLowerCase().includes("virement");
      const isCheck = exp.title.toLowerCase().includes("chèque") || exp.title.toLowerCase().includes("cheque");
      const method = isCheck ? "Chèque" : isTransfer ? "Virement" : "Espèces / Caisse";

      return {
        time: exp.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        label: exp.title,
        categoryOrClass: exp.category,
        method,
        amount: exp.amount,
      };
    });

    const totalIncomes = inflowItems.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = outflowItems.reduce((sum, item) => sum + item.amount, 0);
    const netBalance = totalIncomes - totalExpenses;

    const totalChecks = inflowItems
      .filter((i) => i.method === "Chèque" || Boolean(i.checkDetails))
      .reduce((sum, i) => sum + i.amount, 0);
    const checkCount = inflowItems.filter((i) => i.method === "Chèque" || Boolean(i.checkDetails)).length;

    const totalTransfers = inflowItems
      .filter((i) => i.method === "Virement")
      .reduce((sum, i) => sum + i.amount, 0);

    const totalCash = Math.max(0, totalIncomes - totalChecks - totalTransfers);

    const formattedDate = targetDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const editionTime = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bordereau de Caisse - ${formattedDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      background: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .top-actions {
      display: flex;
      gap: 12px;
      max-width: 820px;
      margin: 0 auto 16px auto;
      position: sticky;
      top: 0;
      background: #f1f5f9;
      padding: 8px 0;
      z-index: 100;
    }
    .btn-print {
      flex: 1;
      background: #059669;
      color: #ffffff;
      border: none;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
      transition: background 0.15s;
    }
    .btn-print:active {
      background: #047857;
    }
    .btn-close {
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 14px 18px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .top-actions {
        display: none !important;
      }
      .page-container {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
    }
    .page-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      padding: 28px 32px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header-bar {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .school-name {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-title {
      font-size: 14px;
      font-weight: 700;
      color: #059669;
      margin-top: 3px;
    }
    .header-meta {
      text-align: right;
      font-size: 11px;
      color: #64748b;
    }
    .header-meta strong {
      color: #0f172a;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      text-align: center;
    }
    .summary-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.4px;
    }
    .summary-value {
      font-size: 20px;
      font-weight: 800;
      margin-top: 4px;
    }
    .summary-sub {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .val-green { color: #059669; }
    .val-red { color: #dc2626; }
    .val-navy { color: #0f172a; }
    .payment-methods-strip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 11px;
      color: #334155;
      display: flex;
      justify-content: space-around;
      margin-bottom: 20px;
    }
    .payment-methods-strip strong {
      color: #0f172a;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 10px;
      border-radius: 6px;
      margin-top: 18px;
      margin-bottom: 8px;
    }
    .sec-green {
      background: #ecfdf5;
      color: #065f46;
      border-left: 4px solid #059669;
    }
    .sec-red {
      background: #fef2f2;
      color: #991b1b;
      border-left: 4px solid #dc2626;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 8px;
    }
    th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 7px 8px;
      border-bottom: 1.5px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .td-amount {
      text-align: right;
      font-weight: 700;
    }
    .empty-row {
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      padding: 12px !important;
    }
    .signatures-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1.5px dashed #cbd5e1;
    }
    .sign-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      min-height: 85px;
      background: #fafafa;
    }
    .sign-title {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .footer-note {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 20px;
    }
  </style>
  <script>
    window.addEventListener('load', function() {
      // Auto-trigger native print dialog after rendering
      setTimeout(function() {
        try {
          window.print();
        } catch(e) {
          console.error(e);
        }
      }, 450);
    });
  </script>
</head>
<body>

  <!-- Top bar (only on screen, hidden when printing) -->
  <div class="top-actions">
    <button class="btn-print" onclick="window.print()">
      🖨️ Lancer l'impression
    </button>
  </div>

  <div class="page-container">
    <!-- Header -->
    <div class="header-bar">
      <div>
        <div class="school-name">${schoolName}</div>
        <div class="doc-title">Bordereau Journalier de Clôture de Caisse</div>
      </div>
      <div class="header-meta">
        <div><strong>Date de caisse :</strong> ${formattedDate}</div>
        <div>Édité le ${editionTime} • SnapSchool Caisse</div>
      </div>
    </div>

    <!-- KPI Summary Grid -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Recettes (+)</div>
        <div class="summary-value val-green">+ ${totalIncomes.toLocaleString("fr-FR")} DT</div>
        <div class="summary-sub">${inflowItems.length} encaissement(s)</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Dépenses (-)</div>
        <div class="summary-value val-red">- ${totalExpenses.toLocaleString("fr-FR")} DT</div>
        <div class="summary-sub">${outflowItems.length} sortie(s)</div>
      </div>
      <div class="summary-card" style="border-color: #0f172a; background: #f8fafc;">
        <div class="summary-label">Solde Net Physique</div>
        <div class="summary-value ${netBalance >= 0 ? "val-green" : "val-red"}">
          ${netBalance >= 0 ? "+ " : ""}${netBalance.toLocaleString("fr-FR")} DT
        </div>
        <div class="summary-sub">Espèces en coffre : ${totalCash.toLocaleString("fr-FR")} DT</div>
      </div>
    </div>

    <!-- Payment Methods Breakdown Strip -->
    <div class="payment-methods-strip">
      <div>💵 <strong>Espèces :</strong> ${totalCash.toLocaleString("fr-FR")} DT</div>
      <div>📑 <strong>Chèques :</strong> ${totalChecks.toLocaleString("fr-FR")} DT (${checkCount})</div>
      <div>🏦 <strong>Virements :</strong> ${totalTransfers.toLocaleString("fr-FR")} DT</div>
    </div>

    <!-- Inflow Table -->
    <div class="section-title sec-green">
      1. Détail des Recettes & Encaissements (${inflowItems.length})
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 55px;">Heure</th>
          <th>Intitulé / Élève</th>
          <th>Classe / Réf</th>
          <th style="width: 90px;">Mode</th>
          <th style="width: 110px; text-align: right;">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${
          inflowItems.length > 0
            ? inflowItems
                .map(
                  (item) => `
              <tr>
                <td>${item.time}</td>
                <td><strong>${item.label}</strong></td>
                <td>${item.categoryOrClass || "—"}</td>
                <td>${item.method}${item.checkDetails ? ` (${item.checkDetails})` : ""}</td>
                <td class="td-amount val-green">+ ${item.amount.toLocaleString("fr-FR")} DT</td>
              </tr>
            `
                )
                .join("")
            : `<tr><td colspan="5" class="empty-row">Aucun encaissement enregistré ce jour.</td></tr>`
        }
      </tbody>
    </table>

    <!-- Outflow Table -->
    <div class="section-title sec-red">
      2. Détail des Dépenses & Décaissements (${outflowItems.length})
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 55px;">Heure</th>
          <th>Motif / Fournisseur</th>
          <th>Catégorie</th>
          <th style="width: 90px;">Mode</th>
          <th style="width: 110px; text-align: right;">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${
          outflowItems.length > 0
            ? outflowItems
                .map(
                  (item) => `
              <tr>
                <td>${item.time}</td>
                <td><strong>${item.label}</strong></td>
                <td>${item.categoryOrClass || "Général"}</td>
                <td>${item.method}</td>
                <td class="td-amount val-red">- ${item.amount.toLocaleString("fr-FR")} DT</td>
              </tr>
            `
                )
                .join("")
            : `<tr><td colspan="5" class="empty-row">Aucune dépense enregistrée ce jour.</td></tr>`
        }
      </tbody>
    </table>

    <!-- Signatures -->
    <div class="signatures-row">
      <div class="sign-box">
        <div class="sign-title">Visa Caissier / Secrétariat</div>
      </div>
      <div class="sign-box">
        <div class="sign-title">Visa & Cachet Direction Générale</div>
      </div>
    </div>

    <div class="footer-note">
      Document comptable officiel généré par SnapSchool • Tous droits réservés
    </div>
  </div>

</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("[Caisse Print Route] Error:", error);
    return new NextResponse("Erreur lors de la préparation du document d'impression", { status: 500 });
  }
}
