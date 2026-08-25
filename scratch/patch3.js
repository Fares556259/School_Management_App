const fs = require('fs');
const file = '/Users/faresselmi/projects/hi/SnapSchool_Web/src/app/(dashboard)/list/teachers/PaySalaryModal.tsx';
let text = fs.readFileSync(file, 'utf8');

const targetMonthEnd = `                  {monthsList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>`;

const newCode = `                  {monthsList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Advance Toggle */}
              <div className="mb-5 flex items-center justify-between p-3 border border-[#e2e8f0] rounded-[8px] bg-[#f8fafc]">
                <label className="text-[13px] font-medium text-[#41454d] cursor-pointer">
                  {t.giveAdvance}
                </label>
                <input 
                  type="checkbox" 
                  checked={isAdvanceMode}
                  onChange={(e) => setIsAdvanceMode(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-[#181d26]"
                />
              </div>

              {isAdvanceMode && (
                <div className="mb-5">
                  <label className="block text-[13px] font-medium text-[#41454d] mb-1.5">{t.advanceAmount} (Max: {finalAmount} DT)</label>
                  <input
                    type="number"
                    value={advanceInput}
                    onChange={(e) => setAdvanceInput(e.target.value)}
                    placeholder="0.00"
                    min={0}
                    max={finalAmount}
                    className="w-full border border-[#dddddd] bg-white rounded-[8px] px-3 py-2.5 outline-none focus:border-[#181d26] focus:ring-1 focus:ring-[#181d26] transition-all text-[14px] text-[#181d26]"
                  />
                </div>
              )}`;

text = text.replace(targetMonthEnd, newCode);

const missedHoursSection = `{/* Missed Hours Section */}`;
const replaceMissedHours = `{!isAdvanceMode && (
              {/* Missed Hours Section */}`;

text = text.replace(missedHoursSection, `{!isAdvanceMode && (\n              <div className="mb-5">`);
// Need to find end of Missed Hours Section... actually easier to wrap the JSX in the file.
fs.writeFileSync(file, text);
