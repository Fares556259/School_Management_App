const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/PaySalaryModal.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/success: "Salary processed successfully!",/g, 'success: "Salary processed successfully!", advanceSuccess: "Advance recorded!", advance: "Advance (Avance)", advanceAmount: "Advance Amount", giveAdvance: "Give Advance", advancePaid: "Advance Paid", remainingToPay: "Remaining to Pay", fullSalary: "Full Salary",');
text = text.replace(/success: "Salaire traité avec succès!",/g, 'success: "Salaire traité avec succès!", advanceSuccess: "Avance enregistrée!", advance: "Avance", advanceAmount: "Montant avance", giveAdvance: "Donner une avance", advancePaid: "Avance payée", remainingToPay: "Reste à payer", fullSalary: "Salaire complet",');
text = text.replace(/success: "تمت معالجة الراتب بنجاح!",/g, 'success: "تمت معالجة الراتب بنجاح!", advanceSuccess: "تم تسجيل السلفة!", advance: "سلفة", advanceAmount: "مبلغ السلفة", giveAdvance: "إعطاء سلفة", advancePaid: "سلفة مدفوعة", remainingToPay: "المتبقي للدفع", fullSalary: "الراتب الكامل",');

fs.writeFileSync(file, text);
