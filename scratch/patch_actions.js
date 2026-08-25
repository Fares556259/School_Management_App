const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/actions.ts';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/isAdvance: boolean = false/g, 'isAdvance: boolean = false,\n  expenseTitleInput?: string,\n  auditDescriptionInput?: string');

const expenseBlockOld = `      // Build expense title with deduction info
      let expenseTitle = isAdvance 
        ? \`Advance: \${teacherName} (\${monthYear})\`
        : \`Salary: \${teacherName} (\${monthYear})\`;
        
      if (deduction && deduction > 0) {
        expenseTitle += \` - \${missedHours}h missed\`;
      }`;
const expenseBlockNew = `      // Build expense title with deduction info
      let expenseTitle = expenseTitleInput || (isAdvance 
        ? \`Advance: \${teacherName} (\${monthYear})\`
        : \`Salary: \${teacherName} (\${monthYear})\`);
        
      if (!expenseTitleInput && deduction && deduction > 0) {
        expenseTitle += \` - \${missedHours}h missed\`;
      }`;
text = text.replace(expenseBlockOld, expenseBlockNew);

const auditBlockOld = `      description: isAdvance
        ? \`Paid advance of \${amountPaidNow} DT to \${teacherName} for \${monthYear}\`
        : \`Paid salary of \${amountPaidNow} DT to \${teacherName} for \${monthYear}\${deduction ? \` (\${missedHours}h missed, -\${deduction} DT deduction)\` : ''}\`,`;
const auditBlockNew = `      description: auditDescriptionInput || (isAdvance
        ? \`Paid advance of \${amountPaidNow} DT to \${teacherName} for \${monthYear}\`
        : \`Paid salary of \${amountPaidNow} DT to \${teacherName} for \${monthYear}\${deduction ? \` (\${missedHours}h missed, -\${deduction} DT deduction)\` : ''}\`),`;
text = text.replace(auditBlockOld, auditBlockNew);

fs.writeFileSync(file, text);
