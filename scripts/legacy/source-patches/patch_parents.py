import sys

# 1. Patch page.tsx
page_file = "src/app/(dashboard)/list/parents/page.tsx"
with open(page_file, "r") as f:
    content = f.read()

# Remove take/skip and orderBy (keep orderBy, it's fine)
content = content.replace("take: ITEM_PER_PAGE,", "")
content = content.replace("skip: ITEM_PER_PAGE * (p - 1),", "")

# Remove query params switch (since search is client side now)
# Wait, studentId is also there, but the user doesn't use it much, or if they do it's from a link. 
# We'll leave studentId in the server logic, but remove search.
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

# 2. Patch ParentListClient.tsx
client_file = "src/app/(dashboard)/list/parents/ParentListClient.tsx"
with open(client_file, "r") as f:
    client_content = f.read()

# Add client search state
client_content = client_content.replace(
    'const [isShareModalOpen, setIsShareModalOpen] = useState(false);',
    'const [isShareModalOpen, setIsShareModalOpen] = useState(false);\n  const [clientSearch, setClientSearch] = useState("");'
)

# Replace TableSearch
client_content = client_content.replace(
    '<TableSearch onPending={setIsSearchPending} />',
    '<TableSearch clientSideOnly onChangeImmediate={(val) => setClientSearch(val)} />'
)

# Filter data
filter_logic = """
  const filteredData = data.filter((item: any) => {
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesName = item.name?.toLowerCase().includes(s);
      const matchesSurname = item.surname?.toLowerCase().includes(s);
      const matchesPhone = item.phone?.toLowerCase().includes(s);
      const matchesStudent = item.students?.some((st: any) => st.name?.toLowerCase().includes(s) || st.surname?.toLowerCase().includes(s));
      if (!matchesName && !matchesSurname && !matchesPhone && !matchesStudent) return false;
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

# Update Table and Pagination props
client_content = client_content.replace('data={data}', 'data={paginatedData}')
client_content = client_content.replace('count={count}', 'count={displayCount}')

with open(client_file, "w") as f:
    f.write(client_content)

print("Patched Parents")
