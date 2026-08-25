import sys

file = "src/app/(dashboard)/list/students/PayStudentModal.tsx"
with open(file, "r") as f:
    content = f.read()

# 1. Add displayBalance
old_1 = """  const tuitionAmount = tuitionFee;
  const remainingBalance = tuitionAmount - initialPaidAmount;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  const [additionalAmount, setAdditionalAmount] = useState(remainingBalance);"""

new_1 = """  const tuitionAmount = tuitionFee;
  const remainingBalance = tuitionAmount - initialPaidAmount;
  const displayBalance = remainingBalance < 0 ? 0 : remainingBalance;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  const [additionalAmount, setAdditionalAmount] = useState(displayBalance);"""

content = content.replace(old_1, new_1)

# 2. Update useEffect
old_2 = """      // Always reset additional amount to the remaining balance for the current target month
      setAdditionalAmount(remainingBalance);"""
new_2 = """      // Always reset additional amount to the remaining balance for the current target month
      setAdditionalAmount(displayBalance);"""

content = content.replace(old_2, new_2)

# 3. Update disabled condition
old_3 = """disabled={isPending || !selectedMonth || (isSkipping && !isPartial) || additionalAmount <= 0}"""
new_3 = """disabled={isPending || !selectedMonth || (isSkipping && !isPartial) || additionalAmount < 0}"""

content = content.replace(old_3, new_3)

# 4. Make sure min is 0 in the input
old_4 = """                    type="number"
                    value={additionalAmount}
                    onChange={(e) => setAdditionalAmount(Number(e.target.value))}
                    max={remainingBalance}
                    min={1}"""
new_4 = """                    type="number"
                    value={additionalAmount}
                    onChange={(e) => setAdditionalAmount(Number(e.target.value))}
                    max={displayBalance > 0 ? displayBalance : 0}
                    min={0}"""

content = content.replace(old_4, new_4)

# 5. Fix remainingBalance text in UI
old_5 = """<strong className="text-[#181d26] font-medium">{remainingBalance} DT</strong>"""
new_5 = """<strong className="text-[#181d26] font-medium">{displayBalance} DT</strong>"""

content = content.replace(old_5, new_5)

with open(file, "w") as f:
    f.write(content)

print("Fixed PayStudentModal")
