import sys

file = "src/app/(dashboard)/list/students/PayStudentModal.tsx"
with open(file, "r") as f:
    content = f.read()

# Replace the single receiveStudentPayment import with the new one
content = content.replace('import { receiveStudentPayment } from "./actions";', 'import { receiveMultipleStudentPayments } from "./actions";')

# Add payments prop
content = content.replace(
    """  paidMonths?: string[];
  tuitionFee?: number;
  onSuccess?: (amount: number, status: "PAID" | "PARTIAL", targetMonth: string) => void;
}) {""",
    """  paidMonths?: string[];
  tuitionFee?: number;
  payments?: any[];
  onSuccess?: (amount: number, status: "PAID" | "PARTIAL", targetMonth: string) => void;
}) {"""
)

# Modify initialization logic to be dynamic!
old_init = """  const tuitionAmount = tuitionFee;
  const remainingBalance = tuitionAmount - initialPaidAmount;
  const displayBalance = remainingBalance < 0 ? 0 : remainingBalance;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  const [additionalAmount, setAdditionalAmount] = useState(displayBalance);
  const [recoveryMonth, setRecoveryMonth] = useState("");
  const [isPending, startTransition] = useTransition();

  // Initialize the modal state when it opens
  useEffect(() => {
    if (isOpen) {
      // If the current target month is already paid, jump to the first unpaid one
      if (!selectedMonth || paidMonths.includes(selectedMonth)) {
        const nextMonth = monthsList[0] || "";
        setSelectedMonth(nextMonth);
      }
      // Always reset additional amount to the remaining balance for the current target month
      setAdditionalAmount(displayBalance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);"""

new_init = """  const tuitionAmount = tuitionFee || 450;
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  
  // Dynamically compute the already paid amount for the currently selected month
  const dynamicInitialPaidAmount = React.useMemo(() => {
    if (!payments || !selectedMonth) return initialPaidAmount || 0;
    const [mName, yStr] = selectedMonth.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);
    const found = payments.find(p => p.month === monthIdx && p.year === yearVal);
    return found?.amount || 0;
  }, [selectedMonth, payments, initialPaidAmount]);

  const remainingBalance = tuitionAmount - dynamicInitialPaidAmount;
  const displayBalance = remainingBalance < 0 ? 0 : remainingBalance;

  const [additionalAmount, setAdditionalAmount] = useState(displayBalance);
  const [recoveryMonth, setRecoveryMonth] = useState("");
  const [isPending, startTransition] = useTransition();

  // Reset additionalAmount when the modal opens or selectedMonth changes
  useEffect(() => {
    if (isOpen) {
      if (!selectedMonth || paidMonths.includes(selectedMonth)) {
        const nextMonth = monthsList[0] || "";
        setSelectedMonth(nextMonth);
      } else {
        setAdditionalAmount(displayBalance);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedMonth]);"""

# wait, I need to make sure React is imported for React.useMemo
if "import React," not in content and "import * as React" not in content and "import { useState," in content:
    content = content.replace("import { useState,", "import React, { useState,")

content = content.replace(old_init, new_init)

# Modify handlePay to split the payment
old_handlePay = """  const handlePay = () => {
    if (!isAdmin || !selectedMonth || (isSkipping && !isPartial)) return;

    const recoveryMonthIdx = allMonths.indexOf(recoveryMonth);
    const totalCumulative = initialPaidAmount + additionalAmount;
    
    const recoveryDate = (totalCumulative < tuitionAmount && recoveryMonthIdx !== -1) 
      ? `2026-${String(recoveryMonthIdx + 1).padStart(2, '0')}-01`
      : undefined;

    setIsOpen(false);
    if (onSuccess) {
      onSuccess(totalCumulative, totalCumulative >= tuitionAmount ? "PAID" : "PARTIAL", selectedMonth);
    }

    startTransition(async () => {
      const result = await receiveStudentPayment(
        studentId,
        studentName,
        tuitionAmount, 
        selectedMonth,
        totalCumulative, // Pass the NEW TOTAL
        recoveryDate
      );
      if (!result.success) {
        alert(result.error);
      }
    });
  };"""

new_handlePay = """  const handlePay = () => {
    if (!isAdmin || !selectedMonth || (isSkipping && !isPartial)) return;

    let moneyToDistribute = additionalAmount;
    let currentIdx = allMonths.indexOf(selectedMonth);
    
    const paymentsToProcess = [];
    
    // We loop to distribute moneyToDistribute across subsequent months
    while ((moneyToDistribute > 0 || paymentsToProcess.length === 0) && currentIdx >= 0 && currentIdx < allMonths.length) {
       const mKey = allMonths[currentIdx];
       const [mName, yStr] = mKey.split(" ");
       const monthIdx = MONTHS.indexOf(mName) + 1;
       const yearVal = parseInt(yStr);
       
       const found = payments?.find(p => p.month === monthIdx && p.year === yearVal);
       const alreadyPaid = found?.amount || 0;
       
       if (currentIdx === allMonths.indexOf(selectedMonth)) {
         // This is the primary month
         const targetTotal = alreadyPaid + moneyToDistribute;
         if (targetTotal > tuitionAmount) {
             const applyHere = tuitionAmount - alreadyPaid;
             // Apply just enough to pay this month fully, if applyHere > 0
             // But wait, what if they overpaid this month already?
             const actualApply = applyHere > 0 ? applyHere : 0;
             paymentsToProcess.push({
                 monthYear: mKey,
                 amount: alreadyPaid + actualApply,
                 isPartial: false,
                 gap: 0
             });
             moneyToDistribute -= actualApply;
         } else {
             paymentsToProcess.push({
                 monthYear: mKey,
                 amount: targetTotal,
                 isPartial: targetTotal < tuitionAmount,
                 gap: tuitionAmount - targetTotal
             });
             moneyToDistribute = 0;
         }
       } else {
         // This is a cascading month
         if (moneyToDistribute > 0) {
             const targetTotal = alreadyPaid + moneyToDistribute;
             if (targetTotal > tuitionAmount) {
                 const applyHere = tuitionAmount - alreadyPaid;
                 const actualApply = applyHere > 0 ? applyHere : 0;
                 paymentsToProcess.push({
                     monthYear: mKey,
                     amount: alreadyPaid + actualApply,
                     isPartial: false,
                     gap: 0
                 });
                 moneyToDistribute -= actualApply;
             } else {
                 paymentsToProcess.push({
                     monthYear: mKey,
                     amount: targetTotal,
                     isPartial: targetTotal < tuitionAmount,
                     gap: tuitionAmount - targetTotal
                 });
                 moneyToDistribute = 0;
             }
         }
       }
       currentIdx++;
    }
    
    // If there is STILL moneyToDistribute (e.g. paid for whole year and excess), apply it to the last processed month
    if (moneyToDistribute > 0 && paymentsToProcess.length > 0) {
        paymentsToProcess[paymentsToProcess.length - 1].amount += moneyToDistribute;
        paymentsToProcess[paymentsToProcess.length - 1].isPartial = false; // Overpaid
        paymentsToProcess[paymentsToProcess.length - 1].gap = 0;
    }

    setIsOpen(false);
    if (onSuccess) {
      // Just fire onSuccess for the selectedMonth to optimistically update it
      const prm = paymentsToProcess[0];
      if (prm) {
         onSuccess(prm.amount, prm.isPartial ? "PARTIAL" : "PAID", prm.monthYear);
      }
    }

    startTransition(async () => {
      const result = await receiveMultipleStudentPayments(
        studentId,
        studentName,
        paymentsToProcess
      );
      if (!result.success) {
        alert(result.error);
      }
    });
  };"""

content = content.replace(old_handlePay, new_handlePay)

# Also fix the initialPaidAmount usages inside the UI block!
content = content.replace("initialPaidAmount > 0", "dynamicInitialPaidAmount > 0")
content = content.replace("{initialPaidAmount} <span", "{dynamicInitialPaidAmount} <span")
content = content.replace("initialPaidAmount / tuitionAmount", "dynamicInitialPaidAmount / tuitionAmount")

with open(file, "w") as f:
    f.write(content)

print("Patched PayStudentModal")
