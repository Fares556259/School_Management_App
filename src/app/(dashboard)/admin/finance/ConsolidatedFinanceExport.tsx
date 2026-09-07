"use client";

import { Download } from "lucide-react";
import { getExpenseNature } from "@/app/(dashboard)/list/expenses/ExpensesListClient";

interface ConsolidatedFinanceExportProps {
  periodLabel: string;
  totalIncome: number;
  totalExpense: number;
  totalSalaries: number;
  totalAdvances: number;
  totalCharges: number;
  netProfit: number;
  profitMargin: string;
  incomes: any[];
  expenses: any[];
}

export default function ConsolidatedFinanceExport({
  periodLabel,
  totalIncome,
  totalExpense,
  totalSalaries,
  totalAdvances,
  totalCharges,
  netProfit,
  profitMargin,
  incomes,
  expenses,
}: ConsolidatedFinanceExportProps) {
  const handleExport = () => {
    // 1. Build unified rows
    const rows: string[] = [];

    // Header metadata
    rows.push(`"=== RAPPORT CONSOLIDÉ DE RENTABILITÉ FINANCIÈRE ==="`);
    rows.push(`"Période d'analyse :","${periodLabel}"`);
    rows.push(`"Date d'export :","${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}"`);
    rows.push("");

    // KPIs summary
    rows.push(`"--- SYNTHÈSE DE RENTABILITÉ ---"`);
    rows.push(`"Indicateur","Montant (DT)","Commentaire"`);
    rows.push(`"TOTAL DES REVENUS PERÇUS","${totalIncome.toFixed(2)}","${incomes.length} encaissements"`);
    rows.push(`"TOTAL DES DÉPENSES ENGAGÉES","${totalExpense.toFixed(2)}","${expenses.length} décaissements"`);
    rows.push(`" > Dont Salaires Complets Soldés","${totalSalaries.toFixed(2)}","Rémunérations validées"`);
    rows.push(`" > Dont Acomptes & Avances sur salaires","${totalAdvances.toFixed(2)}","Avances octroyées"`);
    rows.push(`" > Dont Charges d'Exploitation & Factures","${totalCharges.toFixed(2)}","Loyer, maintenance, fournitures"`);
    rows.push(`"RÉSULTAT NET (BÉNÉFICE)","${netProfit.toFixed(2)}","${netProfit >= 0 ? 'Bénéfice net' : 'Déficit'}"`);
    rows.push(`"TAUX DE MARGE / RENTABILITÉ","${profitMargin}%","Ratio Résultat Net / Revenus"`);
    rows.push("");

    // Ledger table
    rows.push(`"--- GRAND LIVRE DÉTAILLÉ DE LA PÉRIODE ---"`);
    rows.push(`"Flux","Nature Financière","Libellé / Description","Catégorie","Montant (DT)","Date"`);

    // Incomes
    incomes.forEach((i) => {
      const d = new Date(i.date).toLocaleDateString("fr-FR");
      const title = (i.title || "").replace(/"/g, '""');
      const cat = (i.category || "").replace(/"/g, '""');
      rows.push(`"REVENU (+)","Encaissement","${title}","${cat}","+${Number(i.amount).toFixed(2)}","${d}"`);
    });

    // Expenses
    expenses.forEach((e) => {
      const nature = getExpenseNature(e);
      const natureLabel =
        nature === "salary"
          ? "Salaire Soldé"
          : nature === "advance"
          ? "Acompte / Avance"
          : "Charge Opérationnelle";
      const d = new Date(e.date).toLocaleDateString("fr-FR");
      const title = (e.title || "").replace(/"/g, '""');
      const cat = (e.category || "").replace(/"/g, '""');
      rows.push(`"DÉPENSE (-)","${natureLabel}","${title}","${cat}","-${Number(e.amount).toFixed(2)}","${d}"`);
    });

    const csvContent = "\ufeff" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const filename = `Rapport_Rentabilite_${periodLabel.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;

    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md"
      title="Exporter le rapport consolidé de rentabilité"
    >
      <Download size={15} />
      <span>Exporter Bilan Rentabilité</span>
    </button>
  );
}
