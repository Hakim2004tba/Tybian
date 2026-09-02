import type { ReactNode } from "react";

export type AdminTableColumn<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function AdminTable<T>({
  columns,
  rows,
  emptyLabel = "لا توجد بيانات بعد",
  rowKey,
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  emptyLabel?: string;
  rowKey: (row: T) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-[13.5px] text-text-muted-light">{emptyLabel}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className="border-b border-border-light px-4 py-3 text-start text-[12.5px] font-semibold text-text-muted-light"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors hover:bg-bg-light">
              {columns.map((col) => (
                <td key={col.header} className={`border-b border-border-light px-4 py-3.5 ${col.className ?? ""}`}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
