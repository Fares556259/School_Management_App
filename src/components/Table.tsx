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
    <div className="w-full overflow-x-auto" tabIndex={0}>
      <table className="min-w-[800px] w-full border-collapse text-start">
        <thead>
          <tr className="border-y border-ink-200 bg-ink-50 text-xs font-semibold text-ink-600">
            {columns.map((col) => (
              <th scope="col" key={col.accessor} className={`px-5 py-3.5 text-start ${col.className || ""}`}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 text-ink-700">
          {data.length > 0 ? data.map((item) => renderRow(item)) : (
            <tr><td colSpan={columns.length} className="px-5 py-14 text-center text-ink-500">{emptyState}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
