import sys

file = "src/app/(dashboard)/list/incomes/IncomesListClient.tsx"
with open(file, "r") as f:
    content = f.read()

# Add translation for Multi in Arabic
content = content.replace(
    'tTitle = tTitle.replace(/Recovery/i, "استرداد");',
    'tTitle = tTitle.replace(/Recovery/i, "استرداد");\n      tTitle = tTitle.replace(/\\(Multi\\)/i, "(متعدد)");'
)

# Add translation for Multi in French
content = content.replace(
    'tTitle = tTitle.replace(/Recovery/i, "Recouvrement");',
    'tTitle = tTitle.replace(/Recovery/i, "Recouvrement");\n      tTitle = tTitle.replace(/\\(Multi\\)/i, "(Multi)");' # Multi is fine in French, or maybe (Plusieurs)
)
# I will use (Multi) for French, it's very common.

with open(file, "w") as f:
    f.write(content)
