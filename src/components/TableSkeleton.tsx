import React from "react";

const TableSkeleton = ({
  columns,
  rowCount = 6,
}: {
  columns: { header: string; accessor: string; className?: string }[];
  rowCount?: number;
}) => {
  return (
    <div className="overflow-x-auto w-full mt-6">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="border-y border-[#dddddd] text-[13px] font-medium text-[#41454d] bg-slate-50/50">
            {columns.map((col) => (
              <th key={col.accessor} className={`py-4 px-6 ${col.className || ""}`}>
                <div className="h-4 bg-slate-200 animate-pulse rounded-md w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#dddddd]">
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              className="group hover:bg-[#f3f4f6]/40 transition-colors bg-white"
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className={`py-4 px-6 ${col.className || ""}`}>
                  <div className="flex items-center gap-3">
                    {/* If it's the first column, show an avatar skeleton too */}
                    {colIndex === 0 && (
                      <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse shrink-0" />
                    )}
                    <div className="flex flex-col gap-1 w-full">
                      <div
                        className="h-4 bg-slate-200 animate-pulse rounded-md"
                        style={{ width: `${Math.random() * 40 + 40}%` }}
                      />
                      {colIndex === 0 && (
                        <div
                          className="h-3 bg-slate-100 animate-pulse rounded-md mt-1"
                          style={{ width: `${Math.random() * 30 + 30}%` }}
                        />
                      )}
                    </div>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableSkeleton;
