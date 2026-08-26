const fs = require('fs');

const file1 = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/incomes/IncomesListClient.tsx';
let text1 = fs.readFileSync(file1, 'utf8');
text1 = text1.replace('useState(getMonthKey(undefined))', 'useState("")');
fs.writeFileSync(file1, text1);

const file2 = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/expenses/ExpensesListClient.tsx';
let text2 = fs.readFileSync(file2, 'utf8');
text2 = text2.replace('useState(getMonthKey(undefined))', 'useState("")');
fs.writeFileSync(file2, text2);
