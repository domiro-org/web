/**
 * 延迟指定毫秒后再继续执行，常用于重试退避等场景。
 * @param durationMs 等待的毫秒数
 */
export function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(durationMs, 0));
  });
}
