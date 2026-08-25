const fs = require('fs');
['en', 'fr', 'ar'].forEach(lang => {
  const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/lib/translations/' + lang + '.ts';
  let text = fs.readFileSync(file, 'utf8');
  
  // Remove the newly added ones
  text = text.replace(/unpaid: "Unpaid",\n    partial: "Advance",/g, 'unpaid: "Unpaid",');
  text = text.replace(/unpaid: "Non payé",\n    partial: "Avance",/g, 'unpaid: "Non payé",');
  text = text.replace(/unpaid: "غير مدفوع",\n    partial: "سلفة",/g, 'unpaid: "غير مدفوع",');

  fs.writeFileSync(file, text);
});
