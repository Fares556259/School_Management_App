import sys

file = "src/app/(dashboard)/list/students/actions.ts"
with open(file, "r") as f:
    content = f.read()

# I need to carefully replace the Prisma transaction inside receiveStudentPayment
