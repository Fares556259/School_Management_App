import sys

with open("src/app/(dashboard)/list/students/StudentListClient.tsx", "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'const [clientSearch, setClientSearch] = useState("");' in line:
        new_lines.append(line)
        new_lines.append('  const [clientClassId, setClientClassId] = useState(searchParams.get("classId") || "");\n')
        new_lines.append('  const [clientStatus, setClientStatus] = useState(searchParams.get("status") || "");\n')
    elif 'const displayedData = clientSearch ? optimisticData.filter(item =>' in line:
        # We replace the displayedData calculation
        code = """
  const filteredData = optimisticData.filter(item => {
    if (clientSearch) {
      const match = item.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
                    item.surname.toLowerCase().includes(clientSearch.toLowerCase()) ||
                    `${item.name} ${item.surname}`.toLowerCase().includes(clientSearch.toLowerCase());
      if (!match) return false;
    }
    if (clientClassId && String(item.classId) !== clientClassId) {
      return false;
    }
    if (clientStatus) {
      const [mName, yStr] = selectedMonthKey.split(" ");
      const monthIdx = MONTHS.indexOf(mName) + 1;
      const yearVal = parseInt(yStr);
      const currentPayment = item.payments.find((p: any) => p.month === monthIdx && p.year === yearVal);
      const isPaid = currentPayment?.status === "PAID";
      const isPartial = currentPayment?.status === "PARTIAL";

      if (clientStatus === "PAID" && !isPaid) return false;
      if (clientStatus === "PARTIAL" && !isPartial) return false;
      if (clientStatus === "UNPAID" && (isPaid || isPartial)) return false;
    }
    return true;
  });

  const displayedData = filteredData;
  const displayTotalThisMonth = displayedData.length;
  const displayPaidThisMonth = displayedData.filter(item => {
    const [mName, yStr] = selectedMonthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);
    return item.payments.some((p: any) => p.month === monthIdx && p.year === yearVal && p.status === "PAID");
  }).length;

"""
        new_lines.append(code)
    elif 'item.name.toLowerCase().includes(clientSearch.toLowerCase()) || ' in line:
        pass
    elif 'item.surname.toLowerCase().includes(clientSearch.toLowerCase()) ||' in line:
        pass
    elif '`${item.name} ${item.surname}`.toLowerCase().includes(clientSearch.toLowerCase())' in line:
        pass
    elif ') : optimisticData;' in line:
        pass
    else:
        new_lines.append(line)

with open("src/app/(dashboard)/list/students/StudentListClient.tsx", "w") as f:
    f.writelines(new_lines)
print("Patched basic filtering")
