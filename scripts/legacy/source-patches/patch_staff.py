import sys

# 1. Patch page.tsx
page_file = "src/app/(dashboard)/list/staff/page.tsx"
with open(page_file, "r") as f:
    content = f.read()

content = content.replace("take: ITEM_PER_PAGE,", "")
content = content.replace("skip: ITEM_PER_PAGE * (p - 1),", "")
content = content.replace("""          case "search":
            query.AND = value.split(" ").filter(Boolean).map((word) => ({
              OR: [
                { name: { contains: word, mode: "insensitive" } },
                { surname: { contains: word, mode: "insensitive" } },
                { username: { contains: word, mode: "insensitive" } },
                { phone: { contains: word, mode: "insensitive" } },
              ],
            }));
            break;""", "")

with open(page_file, "w") as f:
    f.write(content)

# 2. Patch StaffListClient.tsx
client_file = "src/app/(dashboard)/list/staff/StaffListClient.tsx"
with open(client_file, "r") as f:
    client_content = f.read()

client_content = client_content.replace(
    'const [isSearchPending, setIsSearchPending] = useState(false);',
    'const [isSearchPending, setIsSearchPending] = useState(false);\n  const [clientSearch, setClientSearch] = useState("");'
)

client_content = client_content.replace(
    '<TableSearch onPending={setIsSearchPending} />',
    '<TableSearch clientSideOnly onChangeImmediate={(val) => setClientSearch(val)} />'
)

filter_logic = """
  const filteredData = initialData.filter((item: any) => {
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesName = item.name?.toLowerCase().includes(s);
      const matchesSurname = item.surname?.toLowerCase().includes(s);
      const matchesPhone = item.phone?.toLowerCase().includes(s);
      const matchesRole = item.role?.toLowerCase().includes(s);
      if (!matchesName && !matchesSurname && !matchesPhone && !matchesRole) return false;
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

client_content = client_content.replace('data={initialData}', 'data={paginatedData}')
client_content = client_content.replace('count={count}', 'count={displayCount}')

with open(client_file, "w") as f:
    f.write(client_content)

print("Patched Staff")
