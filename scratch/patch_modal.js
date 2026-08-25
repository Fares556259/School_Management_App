const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/PaySalaryModal.tsx';
let text = fs.readFileSync(file, 'utf8');

// 1. Fix onSuccess type
text = text.replace(/onSuccess\?: \(status: "PAID" \| "PARTIAL", targetMonth: string\) => void;/g, 'onSuccess?: (status: "PAID" | "PARTIAL", targetMonth: string, amount: number) => void;');

// 2. Fix onSuccess call
text = text.replace(/onSuccess\(isAdvanceMode \? "PARTIAL" : "PAID", selectedMonth\);/g, 'onSuccess(isAdvanceMode ? "PARTIAL" : "PAID", selectedMonth, amountToPay);');

// 3. Add advance history box
const insertAfter = `{/* Missed Hours Section */}`;
const historyBox = `              {/* Advance History Section */}
              {!isAdvanceMode && existingAdvance > 0 && (
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[13px] font-medium text-[#41454d]">
                      {t.advancePaid}
                    </label>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 px-3 py-2 rounded-[8px] border text-[14px] font-medium bg-amber-50 border-amber-200 text-amber-700">
                      {existingAdvance.toLocaleString()} DT
                    </div>
                  </div>
                </div>
              )}

              {/* Missed Hours Section */}`;
text = text.replace(insertAfter, historyBox);

fs.writeFileSync(file, text);
