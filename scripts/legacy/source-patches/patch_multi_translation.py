import sys

file = "src/app/(dashboard)/list/incomes/IncomesListClient.tsx"
with open(file, "r") as f:
    content = f.read()

# Add translations for Partial and Recovery
# For Arabic:
content = content.replace(
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(متعدد)");',
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(متعدد)");\n      tTitle = tTitle.replace(/\\(Partial\\)/i, "(جزئي)");\n      tTitle = tTitle.replace(/\\(Recovery\\)/i, "(استرداد)");'
)

# For French:
content = content.replace(
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(Multi)");',
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(Multi)");\n      tTitle = tTitle.replace(/\\(Partial\\)/i, "(Partiel)");\n      tTitle = tTitle.replace(/\\(Recovery\\)/i, "(Recouvrement)");'
)

with open(file, "w") as f:
    f.write(content)
