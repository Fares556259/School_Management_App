const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/PaySalaryModal.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/success: "Salary processed successfully!",/g, 'expensePrefix: "Salary", expenseAdvancePrefix: "Advance", auditSalary: "Paid salary of {amount} DT to {name} for {month}", auditAdvance: "Paid advance of {amount} DT to {name} for {month}", missedSuffix: "missed", deductionSuffix: "deduction", success: "Salary processed successfully!",');

text = text.replace(/success: "Salaire traité avec succès!",/g, 'expensePrefix: "Salaire", expenseAdvancePrefix: "Avance", auditSalary: "Salaire payé de {amount} DT à {name} pour {month}", auditAdvance: "Avance payée de {amount} DT à {name} pour {month}", missedSuffix: "manquées", deductionSuffix: "déduction", success: "Salaire traité avec succès!",');

text = text.replace(/success: "تمت معالجة الراتب بنجاح!",/g, 'expensePrefix: "راتب", expenseAdvancePrefix: "سلفة", auditSalary: "تم دفع راتب قدره {amount} د.ت إلى {name} لشهر {month}", auditAdvance: "تم دفع سلفة قدرها {amount} د.ت إلى {name} لشهر {month}", missedSuffix: "ساعات ضائعة", deductionSuffix: "خصم", success: "تمت معالجة الراتب بنجاح!",');

fs.writeFileSync(file, text);
