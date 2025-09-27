/**
 * 触发浏览器下载 JSON 文件。
 * @param filename 下载文件名
 * @param data 任意可序列化对象
 */
export function downloadJson(filename: string, data: unknown): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
