import sys

file_path = "src/app/(dashboard)/list/incomes/IncomesListClient.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Imports
if 'import { MONTHS, getSchoolYearMonths, getMonthKey }' not in content:
    content = content.replace(
        'import { useLanguage } from "@/lib/translations/LanguageContext";',
        'import { useLanguage } from "@/lib/translations/LanguageContext";\nimport { MONTHS, getSchoolYearMonths, getMonthKey } from "@/lib/dateUtils";'
    )

# 2. States
content = content.replace(
    'const [clientFrom, setClientFrom] = useState("");\n  const [clientTo, setClientTo] = useState("");',
    'const [clientMonthKey, setClientMonthKey] = useState(getMonthKey(new Date()));'
)

# 3. Remove FinanceDateFilter component
content = content.replace('import FinanceDateFilter from "@/components/FinanceDateFilter";\n', '')
content = content.replace(
    '<FinanceDateFilter clientSideOnly onChangeImmediate={(from, to) => { setClientFrom(from); setClientTo(to); }} currentClientFrom={clientFrom} currentClientTo={clientTo} />',
    """
            <select
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-lamaSky focus:ring-1 focus:ring-lamaSky transition-all shadow-sm"
              value={clientMonthKey}
              onChange={(e) => setClientMonthKey(e.target.value)}
            >
              <option value="">{locale === 'ar' ? 'كل الأشهر' : locale === 'fr' ? 'Tous les mois' : 'All months'}</option>
              {getSchoolYearMonths().map(m => {
                const [mName, yStr] = m.split(" ");
                const mIdx = MONTHS.indexOf(mName);
                const translatedMonth = t.months?.[mIdx] || mName;
                return (
                  <option key={m} value={m}>{translatedMonth} {yStr}</option>
                );
              })}
            </select>
    """
)

# 4. Replace filtering logic
old_logic = """  const filteredData = optimisticData.filter((item: any) => {
    if (clientCategory && item.category?.toLowerCase() !== clientCategory.toLowerCase()) return false;
    
    if (clientFrom && new Date(item.date) < new Date(clientFrom)) return false;
    if (clientTo && new Date(item.date) > new Date(clientTo)) return false;
    
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesTitle = item.title?.toLowerCase().includes(s);
      const matchesCat = item.category?.toLowerCase().includes(s);
      if (!matchesTitle && !matchesCat) return false;
    }
    return true;
  });
  
  const ITEM_PER_PAGE = 10;
  const safePage = (p && !isNaN(p) && p > 0) ? p : 1;
  const paginatedData = filteredData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);
  const displayCount = filteredData.length;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let thisMonthTotal = 0;
  let lastMonthTotal = 0;
  let ytdTotal = 0;

  filteredData.forEach(income => {
    const d = new Date(income.date);
    const m = d.getMonth();
    const y = d.getFullYear();
    
    if (y === currentYear) {
      ytdTotal += income.amount;
      if (m === currentMonth) {
        thisMonthTotal += income.amount;
      } else if (m === currentMonth - 1 || (currentMonth === 0 && m === 11 && y === currentYear - 1)) {
        lastMonthTotal += income.amount;
      }
    } else if (currentMonth === 0 && m === 11 && y === currentYear - 1) {
       lastMonthTotal += income.amount;
    }
  });"""

new_logic = """  // 1. Base filter (Search + Category) - used for computing stats
  const baseFilteredData = optimisticData.filter((item: any) => {
    if (clientCategory && item.category?.toLowerCase() !== clientCategory.toLowerCase()) return false;
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesTitle = item.title?.toLowerCase().includes(s);
      const matchesCat = item.category?.toLowerCase().includes(s);
      if (!matchesTitle && !matchesCat) return false;
    }
    return true;
  });

  // 2. Compute stats from baseFilteredData
  let targetMonth = new Date().getMonth();
  let targetYear = new Date().getFullYear();
  if (clientMonthKey) {
    const [mName, yStr] = clientMonthKey.split(" ");
    targetMonth = MONTHS.indexOf(mName);
    targetYear = parseInt(yStr);
  }

  let thisMonthTotal = 0;
  let lastMonthTotal = 0;
  let ytdTotal = 0;

  baseFilteredData.forEach((income: any) => {
    const d = new Date(income.date);
    const m = d.getMonth();
    const y = d.getFullYear();
    
    if (y === targetYear) {
      ytdTotal += income.amount;
      if (m === targetMonth) {
        thisMonthTotal += income.amount;
      } else if (m === targetMonth - 1 || (targetMonth === 0 && m === 11 && y === targetYear - 1)) {
        lastMonthTotal += income.amount;
      }
    } else if (targetMonth === 0 && m === 11 && y === targetYear - 1) {
       lastMonthTotal += income.amount;
    }
  });

  // 3. Table data filter (additionally filter by Month)
  const tableData = baseFilteredData.filter((item: any) => {
    if (!clientMonthKey) return true;
    const d = new Date(item.date);
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  });

  const ITEM_PER_PAGE = 10;
  const safePage = (p && !isNaN(p) && p > 0) ? p : 1;
  const paginatedData = tableData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);
  const displayCount = tableData.length;
"""

content = content.replace(old_logic, new_logic)

with open(file_path, "w") as f:
    f.write(content)

print("Patched Incomes List")
