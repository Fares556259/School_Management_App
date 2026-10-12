const Table = ({
  columns,
  renderRow,
  data,
  emptyState,
}: {
  columns: { header: string; accessor: string; className?: string }[];
  renderRow: (item: any) => React.ReactNode;
  data: any[];
  emptyState?: React.ReactNode;
}) => {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
            {columns.map((col) => (
              <th key={col.accessor} className={`px-6 py-3.5 ${col.className || ""}`}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length > 0 ? data.map((item) => renderRow(item)) : (
            <tr><td colSpan={columns.length} className="px-6 py-14 text-center">{emptyState}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
