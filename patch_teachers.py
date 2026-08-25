import sys

# 1. Patch page.tsx
page_file = "src/app/(dashboard)/list/teachers/page.tsx"
with open(page_file, "r") as f:
    content = f.read()

content = content.replace("take: ITEM_PER_PAGE,", "")
content = content.replace("skip: ITEM_PER_PAGE * (p - 1),", "")

switch_code = """        switch (key) {
          case "classId":
            query.classes = {
              some: {
                id: parseInt(value),
              },
            };
            break;
          case "search":
            query.AND = value.split(" ").filter(Boolean).map((word) => ({
              OR: [
                { name: { contains: word, mode: "insensitive" } },
                { surname: { contains: word, mode: "insensitive" } },
                { username: { contains: word, mode: "insensitive" } },
                { phone: { contains: word, mode: "insensitive" } },
              ],
            }));
            break;
          default:
            break;
        }"""
content = content.replace(switch_code, "")

with open(page_file, "w") as f:
    f.write(content)


# 2. Patch TeacherListClient.tsx
client_file = "src/app/(dashboard)/list/teachers/TeacherListClient.tsx"
with open(client_file, "r") as f:
    client_content = f.read()

# Add client states
client_content = client_content.replace(
    'const [isBulkOpen, setIsBulkOpen] = useState(false);',
    'const [isBulkOpen, setIsBulkOpen] = useState(false);\n  const [clientSearch, setClientSearch] = useState("");\n  const [clientClassId, setClientClassId] = useState(searchParams.get("classId") || "");'
)

# Replace TableSearch
client_content = client_content.replace(
    '<TableSearch onPending={setIsSearchPending} />',
    '<TableSearch clientSideOnly onChangeImmediate={(val) => setClientSearch(val)} />'
)

# Replace classId select onChange
old_classid = """              onChange={(e) => {
                startTransition(() => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (e.target.value) {
                    params.set("classId", e.target.value);
                  } else {
                    params.delete("classId");
                  }
                  params.delete("page");
                  router.push(`${pathname}?${params.toString()}`, { scroll: false });
                });
              }}"""
new_classid = """              onChange={(e) => setClientClassId(e.target.value)}
              value={clientClassId}"""
client_content = client_content.replace(old_classid, new_classid)
client_content = client_content.replace('value={currentClassId}', '')

# Add filtered data logic BEFORE translatedColumns
filter_logic = """
  const filteredData = optimisticData.filter((item: any) => {
    if (clientClassId && !item.classes?.some((c: any) => String(c.id) === clientClassId)) {
      return false;
    }
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesName = item.name?.toLowerCase().includes(s);
      const matchesSurname = item.surname?.toLowerCase().includes(s);
      const matchesPhone = item.phone?.toLowerCase().includes(s);
      const matchesSubjects = item.subjects?.some((sub: any) => sub.name?.toLowerCase().includes(s));
      if (!matchesName && !matchesSurname && !matchesPhone && !matchesSubjects) return false;
    }
    return true;
  });

  const ITEM_PER_PAGE = 10;
  const safePage = (page && !isNaN(page) && page > 0) ? page : 1;
  const paginatedData = filteredData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);
  const displayCount = filteredData.length;
"""

client_content = client_content.replace(
    'const translatedColumns =',
    filter_logic + '\n  const translatedColumns ='
)

client_content = client_content.replace('data={optimisticData}', 'data={paginatedData}')
client_content = client_content.replace('count={count}', 'count={displayCount}')

# Update MonthPaymentSummary total
client_content = client_content.replace('total={initialData.length}', 'total={displayCount}')
# Calculate new paidCount
paid_count_logic = """
  const displayPaidCount = filteredData.filter((t: any) => {
    const monthIdx = MONTHS.indexOf(selectedMonthKey.split(" ")[0]) + 1;
    const yearVal = parseInt(selectedMonthKey.split(" ")[1]);
    return t.payments?.some((p: any) => p.month === monthIdx && p.year === yearVal && p.status === "PAID");
  }).length;
"""
client_content = client_content.replace(
    'const filteredData = optimisticData.filter',
    paid_count_logic + '\n  const filteredData = optimisticData.filter'
)
client_content = client_content.replace('paidCount={paidThisMonth}', 'paidCount={displayPaidCount}')

with open(client_file, "w") as f:
    f.write(client_content)

print("Patched Teachers")
