import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { generateDailyCashRegisterPdf } from "@/lib/pdf/receipts";

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
    const formatParam = searchParams.get("format");

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

    // If PDF format requested directly
    if (formatParam === "pdf") {
      const { buffer, filename } = await generateDailyCashRegisterPdf({
        schoolName,
        date: targetDate,
        adminName: "Direction",
        totalIncomes,
        totalExpenses,
        netBalance,
        totalCash,
        totalChecks,
        checkCount,
        totalTransfers,
        inflowItems,
        outflowItems,
      });

      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Exact label parser matching receipts.ts
    const parseTransactionLabel = (item: {
      label: string;
      categoryOrClass?: string;
      type: "IN" | "OUT";
    }): { client: string; description: string } => {
      let client = "";
      let description = "";

      const clean = item.label.trim();
      if (clean.toLowerCase().startsWith("scolarité")) {
        const parts = clean.replace(/^scolarit[ée]\s*[:\-]?\s*/i, "").trim();
        const parenMatch = parts.match(/^(.*?)\s*\((.*?)\)$/);
        if (parenMatch) {
          client = parenMatch[1].trim();
          description = parenMatch[2].trim();
        } else {
          client = parts;
          description = "Scolarité mensuelle";
        }
        if (item.categoryOrClass && !client.includes(item.categoryOrClass)) {
          client += ` (${item.categoryOrClass})`;
        }
      } else if (clean.toLowerCase().startsWith("frais")) {
        client = item.categoryOrClass || "Élève / Adhérent";
        description = clean;
      } else if (clean.toLowerCase().startsWith("fournitures") || clean.toLowerCase().startsWith("achat")) {
        client = "Fournisseur Bureau";
        description = clean;
      } else if (clean.toLowerCase().startsWith("réparation") || clean.toLowerCase().startsWith("maintenance")) {
        client = "Prestataire Maintenance";
        description = clean;
      } else {
        client = item.categoryOrClass || (item.type === "IN" ? "Client / Parent" : "Fournisseur");
        description = clean;
      }

      return { client, description };
    };

    // Unified Chronological Transactions (Matching Screen 2)
    type UnifiedTx = {
      time: string;
      type: "IN" | "OUT";
      client: string;
      description: string;
      method: string;
      amount: number;
      runningBalance: number;
    };

    const rawTxList = [
      ...inflowItems.map((item) => {
        const parsed = parseTransactionLabel({ label: item.label, categoryOrClass: item.categoryOrClass, type: "IN" });
        const methodStr = item.checkDetails ? `Chq ${item.checkDetails}` : (item.method || "Espèces");
        return {
          time: item.time || "",
          type: "IN" as const,
          client: parsed.client,
          description: parsed.description,
          method: methodStr,
          amount: item.amount,
        };
      }),
      ...outflowItems.map((item) => {
        const parsed = parseTransactionLabel({ label: item.label, categoryOrClass: item.categoryOrClass, type: "OUT" });
        return {
          time: item.time || "",
          type: "OUT" as const,
          client: parsed.client,
          description: parsed.description,
          method: item.method || "Espèces",
          amount: item.amount,
        };
      }),
    ].sort((a, b) => a.time.localeCompare(b.time));

    let running = 0;
    const allTransactions: UnifiedTx[] = rawTxList.map((item) => {
      if (item.type === "IN") {
        running += item.amount;
      } else {
        running -= item.amount;
      }
      return {
        ...item,
        runningBalance: running,
      };
    });

    const formattedDate = targetDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const netSign = netBalance >= 0 ? "+" : "";

    // Generate table rows + empty ledger rows (to fill page identically to Screen 2)
    const targetRowCount = Math.max(18, allTransactions.length + 3);
    const tableRowsHtml: string[] = [];

    for (let i = 0; i < targetRowCount; i++) {
      if (i < allTransactions.length) {
        const tx = allTransactions[i];
        const isOut = tx.type === "OUT";
        const isIn = tx.type === "IN";
        const soldeSign = tx.runningBalance >= 0 ? "" : "-";

        tableRowsHtml.push(`
          <tr>
            <td class="col-date">${tx.time || "—"}</td>
            <td class="col-client"><strong>${tx.client}</strong></td>
            <td class="col-desc">${tx.description}</td>
            <td class="col-out">${isOut ? `${tx.amount.toFixed(2)} DT` : ""}</td>
            <td class="col-in">${isIn ? `${tx.amount.toFixed(2)} DT` : ""}</td>
            <td class="col-type">${tx.method}</td>
            <td class="col-solde">${soldeSign}${Math.abs(tx.runningBalance).toFixed(2)} DT</td>
          </tr>
        `);
      } else {
        // Blank ruled ledger line matching standard accounting book
        tableRowsHtml.push(`
          <tr class="blank-row">
            <td class="col-date">&nbsp;</td>
            <td class="col-client">&nbsp;</td>
            <td class="col-desc">&nbsp;</td>
            <td class="col-out">&nbsp;</td>
            <td class="col-in">&nbsp;</td>
            <td class="col-type">&nbsp;</td>
            <td class="col-solde">&nbsp;</td>
          </tr>
        `);
      }
    }

    const pdfDownloadUrl = `/api/mobile/admin/caisse/print?token=${encodeURIComponent(tokenParam)}&format=pdf${dateParam ? `&date=${encodeURIComponent(dateParam)}` : ""}`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livre de Caisse - ${formattedDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      margin: 0;
      padding: 12px;
      color: #000000;
      background: #f1f5f9;
      font-size: 11px;
    }

    /* Top Sticky Action Bar (Hidden when printed) */
    .top-actions {
      display: flex;
      gap: 12px;
      max-width: 820px;
      margin: 0 auto 12px auto;
      position: sticky;
      top: 0;
      background: #f1f5f9;
      padding: 6px 0;
      z-index: 100;
    }
    .btn-print {
      flex: 1;
      background: #059669;
      color: #ffffff;
      border: none;
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
    }
    .btn-pdf {
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
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
      .ledger-page {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
      }
    }

    /* Formal Accounting Ledger Sheet (1:1 with Screen 2) */
    .ledger-page {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 20px 24px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
      border: 1px solid #cbd5e1;
    }

    .top-brand-stripe {
      height: 3px;
      background: #0f172a;
      margin-bottom: 12px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .school-name {
      font-size: 15px;
      font-weight: 800;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .school-sub {
      font-size: 9.5px;
      color: #4b5563;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
      font-size: 9.5px;
      color: #374151;
      line-height: 1.4;
    }
    .header-meta strong {
      font-size: 10.5px;
      color: #000000;
    }

    /* Centered Title Banner (Clean gray frame) */
    .title-banner {
      background: #f3f4f6;
      border: 1px solid #9ca3af;
      padding: 6px 12px;
      text-align: center;
      font-size: 12.5px;
      font-weight: 800;
      color: #000000;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    /* Sub-Banner */
    .sub-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 6px;
      padding: 0 2px;
    }
    .sub-solde {
      font-size: 11px;
      font-weight: 800;
      color: #000000;
    }

    /* Accounting Grid Table */
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      border: 1px solid #111827;
      margin-bottom: 8px;
    }
    .ledger-table th {
      background: #1f2937;
      color: #ffffff;
      font-weight: 700;
      padding: 5px 4px;
      text-align: center;
      border: 1px solid #111827;
      font-size: 9.5px;
      line-height: 1.15;
    }
    .ledger-table td {
      border: 0.5px solid #9ca3af;
      padding: 4px 6px;
      height: 20px;
      color: #000000;
      vertical-align: middle;
    }
    .ledger-table tr:nth-child(even) td {
      background: #fafafa;
    }

    .col-date { width: 9%; text-align: center; font-size: 9px; color: #4b5563; }
    .col-client { width: 23%; }
    .col-desc { width: 27%; color: #374151; font-size: 9px; }
    .col-out { width: 12%; text-align: right; font-weight: 700; }
    .col-in { width: 12%; text-align: right; font-weight: 700; }
    .col-type { width: 8%; text-align: center; font-size: 8.5px; color: #4b5563; }
    .col-solde { width: 9%; text-align: right; font-weight: 700; }

    .blank-row td {
      background: #ffffff !important;
      border: 0.5px solid #d1d5db;
    }

    /* Bottom Section */
    .bottom-section {
      display: flex;
      gap: 12px;
      margin-top: 6px;
      margin-bottom: 6px;
    }
    .sit-box {
      flex: 1.1;
      border: 1px solid #9ca3af;
      background: #ffffff;
      padding: 6px 10px;
      font-size: 9.5px;
      line-height: 1.5;
    }
    .sit-title {
      font-weight: 800;
      margin-bottom: 3px;
      color: #000000;
    }
    .sit-item {
      color: #374151;
      font-size: 9px;
    }

    .sum-box {
      flex: 0.9;
      border: 1px solid #111827;
      background: #ffffff;
    }
    .sum-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 8px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 9.5px;
    }
    .sum-row-net {
      background: #f3f4f6;
      border-bottom: none;
      font-weight: 800;
      font-size: 11px;
    }

    /* Signatures Section */
    .signatures-box {
      border: 1px solid #9ca3af;
      background: #ffffff;
      display: flex;
      margin-bottom: 8px;
    }
    .sig-col {
      flex: 1;
      padding: 8px 12px;
      min-height: 70px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sig-col-left {
      border-right: 1px solid #9ca3af;
    }
    .sig-title {
      font-weight: 800;
      font-size: 9.5px;
      color: #000000;
    }
    .sig-meta {
      font-size: 8.5px;
      color: #4b5563;
      margin-top: 2px;
    }
    .sig-line {
      border-bottom: 1px solid #9ca3af;
      margin-top: 26px;
      width: 90%;
    }

    .doc-footer {
      text-align: center;
      font-size: 8.5px;
      color: #6b7280;
      margin-top: 8px;
    }
  </style>
  <script>
    window.addEventListener('load', function() {
      // Automatically trigger native print dialog
      setTimeout(function() {
        try {
          window.print();
        } catch(e) {
          console.error(e);
        }
      }, 400);
    });
  </script>
</head>
<body>

  <!-- Top bar (screen only, hidden on print) -->
  <div class="top-actions">
    <button class="btn-print" onclick="window.print()">
      🖨️ Lancer l'impression
    </button>
    <a href="${pdfDownloadUrl}" class="btn-pdf">
      📄 Télécharger le PDF officiel
    </a>
  </div>

  <div class="ledger-page">
    <div class="top-brand-stripe"></div>

    <!-- Header Row -->
    <div class="header-row">
      <div>
        <div class="school-name">${schoolName}</div>
        <div class="school-sub">Établissement Scolaire Privé • Direction & Comptabilité</div>
      </div>
      <div class="header-meta">
        <div><strong>DATE : ${formattedDate}</strong></div>
        <div>Caisse Principale • Page 1/1</div>
        <div>Responsable : Direction</div>
      </div>
    </div>

    <!-- Banner (Identical to Screen 2) -->
    <div class="title-banner">
      LIVRE DE CAISSE — JOURNAL DES ENTRÉES ET SORTIES
    </div>

    <!-- Sub-Banner -->
    <div class="sub-banner">
      <span>Entrer les montants dans l'ordre chronologique :</span>
      <span class="sub-solde">SOLDE DE CAISSE : ${netSign}${netBalance.toFixed(2)} DT</span>
    </div>

    <!-- The Accounting Table -->
    <table class="ledger-table">
      <thead>
        <tr>
          <th style="width: 9%;">Date</th>
          <th style="width: 23%;">Client ou Fournisseur</th>
          <th style="width: 27%;">Description</th>
          <th style="width: 12%;">Sortie de<br>caisse (-)</th>
          <th style="width: 12%;">Entrée de<br>caisse (+)</th>
          <th style="width: 8%;">Type</th>
          <th style="width: 9%;">Solde</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml.join("")}
      </tbody>
    </table>

    <!-- Bottom Section: Situation + Totals -->
    <div class="bottom-section">
      <div class="sit-box">
        <div class="sit-title">SITUATION DES ESPÈCES & CHÈQUES :</div>
        <div class="sit-item">• Espèces en caisse physique : ${totalCash.toFixed(2)} DT</div>
        <div class="sit-item">• Chèques physiques au classeur : ${totalChecks.toFixed(2)} DT (${checkCount} chèque(s))</div>
        <div class="sit-item">• Virements / Dépôts bancaires : ${totalTransfers.toFixed(2)} DT</div>
      </div>

      <div class="sum-box">
        <div class="sum-row">
          <span>Total des entrées</span>
          <span><strong>+${totalIncomes.toFixed(2)} DT</strong></span>
        </div>
        <div class="sum-row">
          <span>Total des sorties</span>
          <span><strong>-${totalExpenses.toFixed(2)} DT</strong></span>
        </div>
        <div class="sum-row sum-row-net">
          <span>Solde total</span>
          <span>${netSign}${netBalance.toFixed(2)} DT</span>
        </div>
      </div>
    </div>

    <!-- Signatures -->
    <div class="signatures-box">
      <div class="sig-col sig-col-left">
        <div class="sig-title">Arrêté de Caisse par le Caissier / Secrétaire :</div>
        <div class="sig-meta">Établi par : Responsable Caisse</div>
        <div class="sig-meta">Certifie la régularité et l'exactitude des opérations.</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-col">
        <div class="sig-title">Validation & Visa Direction Générale :</div>
        <div class="sig-meta">Contrôle journalier arrêté le ${formattedDate}</div>
        <div class="sig-meta">Signature et cachet officiel de l'établissement</div>
        <div class="sig-line"></div>
      </div>
    </div>

    <div class="doc-footer">
      Livre de caisse officiel • Document comptable de référence • Établissement : ${schoolName} • SnapSchool Finance
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
