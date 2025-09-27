import { useEffect, useState } from "react";

/**
 * 在指定延迟后同步外部值，用于削减频繁操作。
 * @param value 原始输入值
 * @param delayMs 延迟毫秒
 * @returns 稳定的防抖后值
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
