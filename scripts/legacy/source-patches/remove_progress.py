import sys

file = "src/app/(dashboard)/list/students/PayStudentModal.tsx"
with open(file, "r") as f:
    content = f.read()

block_to_remove = """              {/* Financial Progress Summary */}
              {initialPaidAmount > 0 && (
                <div className="mb-5 p-4 bg-[#f8fafc] rounded-[8px] border border-[#e2e8f0]">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Payment History</span>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">PARTIAL</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[12px] font-medium text-[#64748b]">Already Paid</p>
                      <p className="text-[16px] font-semibold text-[#181d26]">{initialPaidAmount} <span className="text-[12px] font-normal text-[#64748b]">DT</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-medium text-[#64748b]">Total Due</p>
                      <p className="text-[16px] font-semibold text-[#181d26]">{tuitionAmount} <span className="text-[12px] font-normal text-[#64748b]">DT</span></p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full bg-[#e2e8f0] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: `${(initialPaidAmount / tuitionAmount) * 100}%` }} 
                    />
                  </div>
                </div>
              )}"""

if block_to_remove in content:
    content = content.replace(block_to_remove, "")
    with open(file, "w") as f:
        f.write(content)
    print("Removed")
else:
    print("Not found")
