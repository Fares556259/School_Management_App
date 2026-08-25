const fs = require('fs');
['en', 'fr', 'ar'].forEach(lang => {
  const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/lib/translations/' + lang + '.ts';
  let text = fs.readFileSync(file, 'utf8');
  
  if (lang === 'en') {
    text = text.replace(/outOfTeachers: "out of {count} teachers"/g, 'partial: "Advance",\n    outOfTeachers: "out of {count} teachers"');
  }
  if (lang === 'fr') {
    text = text.replace(/outOfTeachers: "sur {count} enseignants"/g, 'partial: "Avance",\n    outOfTeachers: "sur {count} enseignants"');
  }
  if (lang === 'ar') {
    text = text.replace(/outOfTeachers: "من أصل {count} معلمين"/g, 'partial: "سلفة",\n    outOfTeachers: "من أصل {count} معلمين"');
  }
  
  fs.writeFileSync(file, text);
});
