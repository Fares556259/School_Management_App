const fs = require('fs');
['en', 'fr', 'ar'].forEach(lang => {
  const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/lib/translations/' + lang + '.ts';
  let text = fs.readFileSync(file, 'utf8');
  
  if (lang === 'en') text = text.replace(/unpaid: "Unpaid",/g, 'unpaid: "Unpaid",\\n    partial: "Advance",');
  if (lang === 'fr') text = text.replace(/unpaid: "Non payé",/g, 'unpaid: "Non payé",\\n    partial: "Avance",');
  if (lang === 'ar') text = text.replace(/unpaid: "غير مدفوع",/g, 'unpaid: "غير مدفوع",\\n    partial: "سلفة",');
  
  fs.writeFileSync(file, text.replace(/\\n/g, '\n'));
});
