import sys

file = "src/app/(dashboard)/list/students/PayStudentModal.tsx"
with open(file, "r") as f:
    content = f.read()

content = content.replace(
    """  paidMonths = [],
  tuitionFee = 450,
  onSuccess,""",
    """  paidMonths = [],
  tuitionFee = 450,
  payments = [],
  onSuccess,"""
)

with open(file, "w") as f:
    f.write(content)
