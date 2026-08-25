const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/PaySalaryModal.tsx';
let text = fs.readFileSync(file, 'utf8');

const oldHandlePay = `    startTransition(async () => {
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        amountToPay,
        selectedMonth,
        isAdvanceMode ? undefined : missedHours,
        isAdvanceMode ? undefined : deduction,
        isAdvanceMode
      );`;

const newHandlePay = `    startTransition(async () => {
      let expenseTitle = isAdvanceMode 
        ? \`\${t.expenseAdvancePrefix}: \${teacherName} (\${selectedMonth})\`
        : \`\${t.expensePrefix}: \${teacherName} (\${selectedMonth})\`;
        
      if (!isAdvanceMode && deduction > 0) {
        expenseTitle += \` - \${missedHours}h \${t.missedSuffix}\`;
      }

      let auditDesc = isAdvanceMode
        ? t.auditAdvance.replace("{amount}", amountToPay.toString()).replace("{name}", teacherName).replace("{month}", selectedMonth)
        : t.auditSalary.replace("{amount}", amountToPay.toString()).replace("{name}", teacherName).replace("{month}", selectedMonth);
        
      if (!isAdvanceMode && deduction > 0) {
        auditDesc += \` (\${missedHours}h \${t.missedSuffix}, -\${deduction} DT \${t.deductionSuffix})\`;
      }

      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        amountToPay,
        selectedMonth,
        isAdvanceMode ? undefined : missedHours,
        isAdvanceMode ? undefined : deduction,
        isAdvanceMode,
        expenseTitle,
        auditDesc
      );`;

text = text.replace(oldHandlePay, newHandlePay);
fs.writeFileSync(file, text);
