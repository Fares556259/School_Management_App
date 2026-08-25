import sys

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # Import MONTHS, getSchoolYearMonths
    if "import { MONTHS, getSchoolYearMonths" not in content:
        content = content.replace(
            'import { useLanguage } from "@/lib/translations/LanguageContext";',
            'import { useLanguage } from "@/lib/translations/LanguageContext";\nimport { MONTHS, getSchoolYearMonths, getMonthKey } from "@/lib/dateUtils";'
        )

    # Add clientMonthKey state
    content = content.replace(
        'const [clientFrom, setClientFrom] = useState("");\n  const [clientTo, setClientTo] = useState("");',
        'const [clientMonthKey, setClientMonthKey] = useState(getMonthKey(new Date()));'
    )
    
    # Remove FinanceDateFilter import and usage
    content = content.replace('import FinanceDateFilter from "@/components/FinanceDateFilter";\n', '')
    content = content.replace(
        '<FinanceDateFilter clientSideOnly onChangeImmediate={(from, to) => { setClientFrom(from); setClientTo(to); }} currentClientFrom={clientFrom} currentClientTo={clientTo} />',
        ''
    )

    # Replace filtering logic
    old_filter = """  const filteredData = optimisticData.filter((item: any) => {
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
"""
    
    # Wait, the Expenses logic might have matchesName instead of matchesTitle!
    # Let's write a generic replacement by splitting the string.

    return content

# I will do standard string replacements.
