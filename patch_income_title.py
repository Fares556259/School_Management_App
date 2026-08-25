import sys

file = "src/app/(dashboard)/list/students/actions.ts"
with open(file, "r") as f:
    content = f.read()

old_loop = """        const existing = await tx.payment.findUnique({
          where: {
            studentId_month_year: { studentId, month: monthIdx, year: yearVal }
          }
        });

        const previousAmount = existing?.amount || 0;
        const newMoney = pmt.amount - previousAmount;
        if (newMoney > 0) totalNewMoneyCollected += newMoney;"""

new_loop = """        const existing = await tx.payment.findUnique({
          where: {
            studentId_month_year: { studentId, month: monthIdx, year: yearVal }
          }
        });

        const previousAmount = existing?.amount || 0;
        const newMoney = pmt.amount - previousAmount;
        if (newMoney > 0) totalNewMoneyCollected += newMoney;
        if (existing && newMoney > 0) pmt.isRecovery = true;"""

content = content.replace(old_loop, new_loop)

old_title_logic = """      if (totalNewMoneyCollected > 0) {
        // Find the earliest month to use as the title reference, or just combine them
        const titleRef = paymentsToProcess.length === 1 
          ? paymentsToProcess[0].monthYear 
          : `${paymentsToProcess[0].monthYear} (Multi)`;

        await tx.income.create({
          data: {
            title: `Tuition: ${studentName} (${titleRef})`,"""

new_title_logic = """      if (totalNewMoneyCollected > 0) {
        // Find the earliest month to use as the title reference, or just combine them
        let suffix = "";
        const isRecovery = paymentsToProcess.some((p: any) => p.isRecovery);
        if (paymentsToProcess.length > 1) {
          suffix = " (Multi)";
        } else if (paymentsToProcess[0].isPartial) {
          suffix = " (Partial)";
        } else if (isRecovery) {
          suffix = " (Recovery)";
        }
        const titleRef = paymentsToProcess[0].monthYear + suffix;

        await tx.income.create({
          data: {
            title: `Tuition: ${studentName} (${titleRef})`,"""

content = content.replace(old_title_logic, new_title_logic)

with open(file, "w") as f:
    f.write(content)
