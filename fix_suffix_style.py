# Change suffix style from (Tag) to - Tag, consistent with - Recouvrement

file_actions = "src/app/(dashboard)/list/students/actions.ts"
with open(file_actions, "r") as f:
    content = f.read()

content = content.replace('suffix = " (Combined)";', 'suffix = " - Combined";')
content = content.replace('suffix = " (Partial)";', 'suffix = " - Partial";')
content = content.replace('suffix = " (Recovery)";', 'suffix = " - Recovery";')
# Also fix the legacy "(Multi)" reference if it exists
content = content.replace('suffix = " (Multi)";', 'suffix = " - Combined";')

with open(file_actions, "w") as f:
    f.write(content)

# Now fix the translation patterns in IncomesListClient.tsx
file_incomes = "src/app/(dashboard)/list/incomes/IncomesListClient.tsx"
with open(file_incomes, "r") as f:
    content = f.read()

# Arabic: change (دفعة مجمعة) -> - دفعة مجمعة, (جزئي) -> - جزئي, (استرداد) -> already handled as Recovery
content = content.replace(
    'tTitle = tTitle.replace(/\\(Combined\\)/i, "(دفعة مجمعة)");',
    'tTitle = tTitle.replace(/ - Combined/i, " - دفعة مجمعة");'
)
content = content.replace(
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(متعدد)");',
    'tTitle = tTitle.replace(/ - Multi/i, " - دفعة مجمعة");'
)
content = content.replace(
    'tTitle = tTitle.replace(/\\(Partial\\)/i, "(جزئي)");',
    'tTitle = tTitle.replace(/ - Partial/i, " - جزئي");'
)
content = content.replace(
    'tTitle = tTitle.replace(/\\(Recovery\\)/i, "(استرداد)");',
    'tTitle = tTitle.replace(/Recovery/i, "استرداد");'
)

# French: change (Paiement groupé) -> - Paiement groupé, etc.
content = content.replace(
    'tTitle = tTitle.replace(/\\(Combined\\)/i, "(Paiement groupé)");',
    'tTitle = tTitle.replace(/ - Combined/i, " - Paiement groupé");'
)
content = content.replace(
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(Multi)");',
    'tTitle = tTitle.replace(/ - Multi/i, " - Paiement groupé");'
)
content = content.replace(
    'tTitle = tTitle.replace(/\\(Partial\\)/i, "(Partiel)");',
    'tTitle = tTitle.replace(/ - Partial/i, " - Partiel");'
)
content = content.replace(
    'tTitle = tTitle.replace(/\\(Recovery\\)/i, "(Recouvrement)");',
    'tTitle = tTitle.replace(/Recovery/i, "Recouvrement");'
)

with open(file_incomes, "w") as f:
    f.write(content)

print("Done - suffix style now matches Recouvrement style")
