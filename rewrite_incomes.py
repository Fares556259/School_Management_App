import sys

# 1. Patch page.tsx
page_file = "src/app/(dashboard)/list/incomes/page.tsx"
with open(page_file, "r") as f:
    content = f.read()

# I will replace the entire getCachedTenantData block
old_query = """  // URL QUERY PARAMS CONDITION
  const query: Prisma.IncomeWhereInput = { schoolId };

  if (search) {
    query.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category) {
    query.category = { equals: category, mode: "insensitive" };
  }

  if (from || to) {
    query.date = {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    };
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Parallelize DB queries for maximum speed with tenant caching
  const [data, count, uniqueCategoriesData, allData] = await getCachedTenantData(
    schoolId,
    'incomes',
    [p, JSON.stringify(searchParams)],
    () => Promise.all([
      prisma.income.findMany({
        where: query,
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
        orderBy: { date: "desc" },
      }),
      prisma.income.count({ where: query }),
      prisma.income.findMany({
        where: { schoolId },
        select: { category: true },
        distinct: ["category"],
      }),
      prisma.income.findMany({
        where: { ...query, date: { gte: twelveMonthsAgo } },
        orderBy: { date: "desc" },
      }),
    ]),
    300
  );"""

new_query = """  // Fetch all incomes for client-side filtering
  const [data, uniqueCategoriesData] = await getCachedTenantData(
    schoolId,
    'incomes',
    [],
    () => Promise.all([
      prisma.income.findMany({
        where: { schoolId },
        orderBy: { date: "desc" },
      }),
      prisma.income.findMany({
        where: { schoolId },
        select: { category: true },
        distinct: ["category"],
      })
    ]),
    300
  );"""

content = content.replace(old_query, new_query)
content = content.replace('count={count}', 'count={data.length}')
content = content.replace('allData={allData}', 'allData={data}')

with open(page_file, "w") as f:
    f.write(content)


# 2. Patch IncomesListClient.tsx
client_file = "src/app/(dashboard)/list/incomes/IncomesListClient.tsx"
with open(client_file, "r") as f:
    client = f.read()

# Add states
client = client.replace(
    'const { t, locale } = useLanguage();',
    'const { t, locale } = useLanguage();\n  const [clientSearch, setClientSearch] = useState("");\n  const [clientCategory, setClientCategory] = useState("");\n  const [clientFrom, setClientFrom] = useState("");\n  const [clientTo, setClientTo] = useState("");'
)

# Fix FinanceDateFilter and TableSearch
client = client.replace(
    '<TableSearch />',
    '<TableSearch clientSideOnly onChangeImmediate={(val) => setClientSearch(val)} />'
)
client = client.replace(
    '<FinanceDateFilter />',
    '<FinanceDateFilter clientSideOnly onChangeImmediate={(from, to) => { setClientFrom(from); setClientTo(to); }} currentClientFrom={clientFrom} currentClientTo={clientTo} />'
)

# Filter logic
filter_logic = """
  const filteredData = optimisticData.filter((item: any) => {
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

client = client.replace('const now = new Date();', filter_logic + '\n  const now = new Date();')

# Use filteredData instead of allData for stats
client = client.replace('allData.forEach(income => {', 'filteredData.forEach(income => {')

# Use paginatedData for table
client = client.replace('data={optimisticData}', 'data={paginatedData}')
client = client.replace('count={count}', 'count={displayCount}')
client = client.replace('>{count}<', '>{displayCount}<')

# Fix tabs
client = client.replace(
    'href="/list/incomes"',
    'href="#" onClick={(e) => { e.preventDefault(); setClientCategory(""); }}'
)
client = client.replace('!category ?', '!clientCategory ?')

tab_old = """            <Link 
              prefetch={true} 
              key={val} 
              href={{ pathname: "/list/incomes", query: { category: val } }} 
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${category === val ? activeClass : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
            >
              {label}
            </Link>"""
tab_new = """            <button 
              key={val} 
              onClick={() => setClientCategory(val)} 
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${clientCategory === val ? activeClass : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
            >
              {label}
            </button>"""
client = client.replace(tab_old, tab_new)
client = client.replace('category === val', 'clientCategory === val')

with open(client_file, "w") as f:
    f.write(client)

print("Patched Incomes")
