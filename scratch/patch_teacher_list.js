const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/TeacherListClient.tsx';
let text = fs.readFileSync(file, 'utf8');

// 1. Update translations for PARTIAL
text = text.replace(/unpaid: "Unpaid"/g, 'unpaid: "Unpaid", partial: "Advance"');
text = text.replace(/unpaid: "Non payé"/g, 'unpaid: "Non payé", partial: "Avance"');
text = text.replace(/unpaid: "غير مدفوع"/g, 'unpaid: "غير مدفوع", partial: "سلفة"');

// 2. Add paymentStatusThisMonth
const isPaidOriginal = `    const isPaidThisMonth = item.payments.some(
      (p) => p.month === monthIdx && p.year === yearVal && p.status === "PAID"
    );`;

const isPaidNew = `    const paymentThisMonth = item.payments.find(
      (p) => p.month === monthIdx && p.year === yearVal
    );
    const paymentStatusThisMonth = paymentThisMonth?.status || "UNPAID";
    const isPaidThisMonth = paymentStatusThisMonth === "PAID";`;

text = text.replace(isPaidOriginal, isPaidNew);

// 3. Update the UI rendering
const uiOriginal = `        <td className="py-4 px-6">
          {isPaidThisMonth ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium whitespace-nowrap">
              {t.teachers.paid}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium whitespace-nowrap">
              {t.teachers.unpaid}
            </span>
          )}
        </td>`;

const uiNew = `        <td className="py-4 px-6">
          {paymentStatusThisMonth === "PAID" ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium whitespace-nowrap">
              {t.teachers.paid}
            </span>
          ) : paymentStatusThisMonth === "PARTIAL" ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-amber-50 border border-amber-200 text-amber-700 text-[12px] font-medium whitespace-nowrap">
              {t.teachers.partial}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium whitespace-nowrap">
              {t.teachers.unpaid}
            </span>
          )}
        </td>`;

text = text.replace(uiOriginal, uiNew);

fs.writeFileSync(file, text);
