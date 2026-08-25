const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/PaySalaryModal.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/>\s*Process Salary\s*<\/h2>/g, '>{t.processSalary}</h2>');
text = text.replace(/For <span/g, '{t.for} <span');
text = text.replace(/>\s*Target Month\s*<\/label>/g, '>{t.targetMonth}</label>');
text = text.replace(/>Select Month<\/option>/g, '>{t.selectMonth}</option>');
text = text.replace(/>Salary Breakdown<\/span>/g, '>{t.salaryBreakdown}</span>');
text = text.replace(/>Hourly Rate<\/span>/g, '>{t.hourlyRate}</span>');
text = text.replace(/>Monthly Hours<\/span>/g, '>{t.monthlyHours}</span>');
text = text.replace(/>Base Salary<\/span>/g, '>{t.baseSalary}</span>');
text = text.replace(/>\s*Missed Hours\s*<\/label>/g, '>{t.missedHours}</label>');
text = text.replace(/>\s*Reset\s*<\/button>/g, '>{t.reset}</button>');
text = text.replace(/hours missed/g, '{t.hoursMissed}');
text = text.replace(/\(deduction\)/g, '({t.deduction})');
text = text.replace(/>\s*\+ Add\s*<\/button>/g, '>{t.add}</button>');
text = text.replace(/>Final Amount<\/span>/g, '>{t.finalAmount}</span>');
text = text.replace(/placeholder="Hours to add"/g, 'placeholder={t.hoursToAdd}');
text = text.replace(/>\s*Cancel\s*<\/button>/g, '>{t.cancel}</button>');
text = text.replace(/"Confirming..." : "Confirm Payment"/g, 't.confirming : t.confirmPayment');
text = text.replace(/"Please pay for <strong/g, 't.skipWarning.split("{earliestUnpaid}")[0] + <strong');
text = text.replace(/<\/strong> first to maintain chronological bookkeeping."/g, '</strong> + t.skipWarning.split("{earliestUnpaid}")[1]');
text = text.replace(/title="Process Salary"/g, 'title={t.processSalary}');
text = text.replace(/"Salary processed successfully!"/g, 't.success');
text = text.replace(/"Failed to process salary"/g, 't.error');

fs.writeFileSync(file, text);
