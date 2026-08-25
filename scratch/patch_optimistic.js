const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/TeacherListClient.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/onSuccess=\{\(newStatus, targetMonth\) => \{/g, 'onSuccess={(newStatus, targetMonth, amountPaidNow) => {');
text = text.replace(/payments\[existingIdx\] = \{ \.\.\.payments\[existingIdx\], status: newStatus \};/g, 'payments[existingIdx] = { ...payments[existingIdx], status: newStatus, amount: (payments[existingIdx].amount || 0) + amountPaidNow };');
text = text.replace(/payments\.push\(\{ month: monthIdx, year: yearVal, status: newStatus \}\);/g, 'payments.push({ month: monthIdx, year: yearVal, status: newStatus, amount: amountPaidNow });');

fs.writeFileSync(file, text);
