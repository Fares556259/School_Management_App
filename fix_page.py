import sys

with open("src/app/(dashboard)/list/students/StudentListClient.tsx", "r") as f:
    content = f.read()

content = content.replace(
    'const paginatedData = displayedData.slice((page - 1) * ITEM_PER_PAGE, page * ITEM_PER_PAGE);',
    'const safePage = (page && !isNaN(page) && page > 0) ? page : 1;\n  const paginatedData = displayedData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);'
)

with open("src/app/(dashboard)/list/students/StudentListClient.tsx", "w") as f:
    f.write(content)

with open("src/components/Pagination.tsx", "r") as f:
    content = f.read()

content = content.replace(
    'const hasPrev = ITEM_PER_PAGE * (page - 1) > 0;',
    'const safePage = (page && !isNaN(page) && page > 0) ? page : 1;\n  const hasPrev = ITEM_PER_PAGE * (safePage - 1) > 0;'
)
content = content.replace('page - 1', 'safePage - 1')
content = content.replace('page + 1', 'safePage + 1')
content = content.replace('page === p', 'safePage === p')
content = content.replace('page !== p', 'safePage !== p')
content = content.replace('page - range', 'safePage - range')
content = content.replace('page + range', 'safePage + range')

with open("src/components/Pagination.tsx", "w") as f:
    f.write(content)

print("Patched pagination safety")
