const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/lib/translations/ar.ts';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/outOfTeachers: "من أصل \{count\} أستاذ"/g, 'partial: "سلفة",\n    outOfTeachers: "من أصل {count} أستاذ"');

fs.writeFileSync(file, text);
