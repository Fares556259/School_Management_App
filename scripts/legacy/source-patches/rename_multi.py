import sys

# 1. Update actions.ts
file_actions = "src/app/(dashboard)/list/students/actions.ts"
with open(file_actions, "r") as f:
    content_actions = f.read()

content_actions = content_actions.replace('suffix = " (Multi)";', 'suffix = " (Combined)";')
content_actions = content_actions.replace(' : `${paymentsToProcess[0].monthYear} (Multi)`;', ' : `${paymentsToProcess[0].monthYear} (Combined)`;')

with open(file_actions, "w") as f:
    f.write(content_actions)

# 2. Update IncomesListClient.tsx
file_incomes = "src/app/(dashboard)/list/incomes/IncomesListClient.tsx"
with open(file_incomes, "r") as f:
    content_incomes = f.read()

# Replace Arabic
content_incomes = content_incomes.replace(
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(متعدد)");',
    'tTitle = tTitle.replace(/\\(Combined\\)/i, "(دفعة مجمعة)");'
)
# Wait, let's also keep (Multi) in case there are historical records!
content_incomes = content_incomes.replace(
    'tTitle = tTitle.replace(/\\(Partial\\)/i, "(جزئي)");',
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(متعدد)");\n      tTitle = tTitle.replace(/\\(Partial\\)/i, "(جزئي)");'
)

# Replace French
content_incomes = content_incomes.replace(
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(Multi)");',
    'tTitle = tTitle.replace(/\\(Combined\\)/i, "(Paiement groupé)");'
)
content_incomes = content_incomes.replace(
    'tTitle = tTitle.replace(/\\(Partial\\)/i, "(Partiel)");',
    'tTitle = tTitle.replace(/\\(Multi\\)/i, "(Multi)");\n      tTitle = tTitle.replace(/\\(Partial\\)/i, "(Partiel)");'
)

with open(file_incomes, "w") as f:
    f.write(content_incomes)

print("Renamed Multi to Combined")
