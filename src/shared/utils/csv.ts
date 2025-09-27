/**
 * CSV 列定义，包含标题与访问器。
 */
export interface CsvColumn<T> {
  /** CSV 列唯一键 */
  key: string;
  /** 表头显示文本 */
  header: string;
  /** 从数据行中提取值的函数 */
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * 按照提供的列定义构建 UTF-8 BOM CSV 字符串。
 * @param rows 数据行集合
 * @param columns 列定义数组
 * @returns UTF-8 带 BOM 的 CSV 字符串
 */
export function buildCsvContent<T>(rows: T[], columns: Array<CsvColumn<T>>): string {
  const headerLine = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => escapeCsvCell(column.accessor(row)))
      .join(",")
  );

  const csvBody = [headerLine, ...lines].join("\n");
  return `\ufeff${csvBody}`;
}

/**
 * 触发浏览器下载 CSV 文件。
 * @param filename 下载文件名
 * @param content CSV 字符串
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * 为 CSV 字段添加引号并转义特殊字符。
 */
function escapeCsvCell(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  const stringValue = String(value);
  if (stringValue.includes("\"") || stringValue.includes(",") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}
