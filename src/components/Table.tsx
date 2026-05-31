const Table = ({
  columns,
  renderRow,
  data,
}: {
  columns: { header: string; accessor: string; className?: string }[];
  renderRow: (item: any) => React.ReactNode;
  data: any[];
}) => {
  return (
    <div className="overflow-x-auto w-full mt-6">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="border-y border-[#dddddd] text-[13px] font-medium text-[#41454d] bg-slate-50/50">
            {columns.map((col) => (
              <th key={col.accessor} className={`py-4 px-6 ${col.className || ""}`}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#dddddd]">{data.map((item) => renderRow(item))}</tbody>
      </table>
    </div>
  );
};

export default Table;
