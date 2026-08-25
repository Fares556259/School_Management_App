import sys

with open("src/app/(dashboard)/list/teachers/TeacherListClient.tsx", "r") as f:
    content = f.read()

# I want to move displayPaidCount AFTER filteredData
old = """
  const displayPaidCount = filteredData.filter((t: any) => {
    const monthIdx = MONTHS.indexOf(selectedMonthKey.split(" ")[0]) + 1;
    const yearVal = parseInt(selectedMonthKey.split(" ")[1]);
    return t.payments?.some((p: any) => p.month === monthIdx && p.year === yearVal && p.status === "PAID");
  }).length;

  const filteredData = optimisticData.filter"""

new = """
  const filteredData = optimisticData.filter"""

content = content.replace(old, new)

# And now place it after filteredData
old_after = """  const displayCount = filteredData.length;
"""
new_after = """  const displayCount = filteredData.length;

  const displayPaidCount = filteredData.filter((t: any) => {
    const monthIdx = MONTHS.indexOf(selectedMonthKey.split(" ")[0]) + 1;
    const yearVal = parseInt(selectedMonthKey.split(" ")[1]);
    return t.payments?.some((p: any) => p.month === monthIdx && p.year === yearVal && p.status === "PAID");
  }).length;
"""
content = content.replace(old_after, new_after)

with open("src/app/(dashboard)/list/teachers/TeacherListClient.tsx", "w") as f:
    f.write(content)
