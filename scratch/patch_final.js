const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/PaySalaryModal.tsx';
let text = fs.readFileSync(file, 'utf8');

// 1. Add translations
text = text.replace(/success: "Salary processed successfully!",/g, 'success: "Salary processed successfully!", advanceSuccess: "Advance recorded!", advance: "Advance (Avance)", advanceAmount: "Advance Amount", giveAdvance: "Give Advance", advancePaid: "Advance Paid", remainingToPay: "Remaining to Pay", fullSalary: "Full Salary",');
text = text.replace(/success: "Salaire traité avec succès!",/g, 'success: "Salaire traité avec succès!", advanceSuccess: "Avance enregistrée!", advance: "Avance", advanceAmount: "Montant avance", giveAdvance: "Donner une avance", advancePaid: "Avance payée", remainingToPay: "Reste à payer", fullSalary: "Salaire complet",');
text = text.replace(/success: "تمت معالجة الراتب بنجاح!",/g, 'success: "تمت معالجة الراتب بنجاح!", advanceSuccess: "تم تسجيل السلفة!", advance: "سلفة", advanceAmount: "مبلغ السلفة", giveAdvance: "إعطاء سلفة", advancePaid: "سلفة مدفوعة", remainingToPay: "المتبقي للدفع", fullSalary: "الراتب الكامل",');

// 2. Add functions and state
const funcStart = `  const getExistingMissedHours = (monthKey: string): number => {`;
const newFuncs = `  const getExistingAdvance = (monthKey: string): number => {
    if (!payments || !monthKey) return 0;
    const [mName, yStr] = monthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);
    const found = payments.find(p => p.month === monthIdx && p.year === yearVal && p.status === "PARTIAL");
    return found?.amount || 0;
  };

  const getExistingMissedHours = (monthKey: string): number => {`;
text = text.replace(funcStart, newFuncs);

const stateStart = `  const [missedHours, setMissedHours] = useState(0);`;
const newState = `  const [missedHours, setMissedHours] = useState(0);
  const [addHours, setAddHours] = useState<number | string>(0);
  const [isAdvanceMode, setIsAdvanceMode] = useState(false);
  const [advanceInput, setAdvanceInput] = useState<number | string>("");`;
text = text.replace(`  const [missedHours, setMissedHours] = useState(0);\n  const [addHours, setAddHours] = useState<number | string>(0);`, newState);

// 3. Update math
const mathStart = `  const deduction = missedHours * rate;\n  const finalAmount = Math.max(0, baseSalary - deduction);`;
const newMath = `  const existingAdvance = getExistingAdvance(selectedMonth);
  const deduction = missedHours * rate;
  const finalAmount = Math.max(0, baseSalary - deduction - existingAdvance);`;
text = text.replace(mathStart, newMath);

// 4. Update handlePay
const handlePayOriginal = `  const handlePay = () => {
    if (!isAdmin || !selectedMonth || isSkipping) return;

    setIsOpen(false);
    if (onSuccess) {
      onSuccess("PAID", selectedMonth);
    }

    startTransition(async () => {
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        finalAmount,
        selectedMonth,
        missedHours,
        deduction
      );
      if (!result.success) {
        console.error("Failed to process payment");
      }
    });
  };`;
const handlePayNew = `  const handlePay = () => {
    if (!isAdmin || !selectedMonth || isSkipping) return;
    
    const amountToPay = isAdvanceMode ? Number(advanceInput) : finalAmount;
    if (isAdvanceMode && (amountToPay <= 0 || amountToPay > finalAmount)) return;

    setIsOpen(false);
    if (onSuccess) {
      onSuccess(isAdvanceMode ? "PARTIAL" : "PAID", selectedMonth);
    }

    startTransition(async () => {
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        amountToPay,
        selectedMonth,
        isAdvanceMode ? undefined : missedHours,
        isAdvanceMode ? undefined : deduction,
        isAdvanceMode
      );
      if (!result.success) {
        console.error("Failed to process payment");
      }
    });
  };`;
text = text.replace(handlePayOriginal, handlePayNew);

fs.writeFileSync(file, text);
