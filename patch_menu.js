const fs = require('fs');
let content = fs.readFileSync('src/components/Menu.tsx', 'utf8');

// 1. Add logic to calculate year and term inside the Menu component
// We'll inject it right after `const { t, locale } = useLanguage();`

const hookLine = 'const { t, locale } = useLanguage();';
const injection = `
  const today = new Date();
  const currentMonth = today.getMonth(); // 0 = Jan, 7 = Aug
  let academicYear = "";
  if (currentMonth >= 7) {
    academicYear = \`\${today.getFullYear()}–\${today.getFullYear() + 1}\`;
  } else {
    academicYear = \`\${today.getFullYear() - 1}–\${today.getFullYear()}\`;
  }

  let currentTerm = 1;
  if (currentMonth >= 0 && currentMonth <= 2) currentTerm = 2; // Jan-Mar
  else if (currentMonth >= 3 && currentMonth <= 5) currentTerm = 3; // Apr-Jun
  else currentTerm = 1; // Jul-Dec

  const getBadgeTranslations = () => {
    switch(locale) {
      case "ar": return { year: "السنة", term: "الثلاثي", online: "متصل" };
      case "fr": return { year: "Année", term: "Trimestre", online: "En ligne" };
      case "en": 
      default: return { year: "Year", term: "Term", online: "Online" };
    }
  };
  const badgeT = getBadgeTranslations();
`;

content = content.replace(hookLine, hookLine + '\\n' + injection);

// 2. Replace the hardcoded JSX
const oldJSX = `<span className="text-[12px] font-bold text-slate-800 truncate">
                Année 2024–2025
              </span>
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <span className="text-[10.5px] text-slate-500 font-medium">
              Trimestre 2 • En ligne
            </span>`;

const newJSX = `<span className="text-[12px] font-bold text-slate-800 truncate">
                {badgeT.year} {academicYear}
              </span>
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <span className="text-[10.5px] text-slate-500 font-medium">
              {badgeT.term} {currentTerm} • {badgeT.online}
            </span>`;

content = content.replace(oldJSX, newJSX);

fs.writeFileSync('src/components/Menu.tsx', content);
console.log("Patched Menu.tsx");
