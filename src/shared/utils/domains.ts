import type { DomainItem } from "../types";

/**
 * 构建已存在域名的 ASCII 集合，便于快速判重。
 */
export function createAsciiSet(domains: DomainItem[]): Set<string> {
  const asciiSet = new Set<string>();
  for (const domain of domains) {
    asciiSet.add(domain.ascii);
  }
  return asciiSet;
}

export interface PartitionResult {
  /** 可新增的域名 */
  fresh: DomainItem[];
  /** 与现有列表重复的域名 */
  duplicate: DomainItem[];
}

/**
 * 根据现有集合划分域名，找出新增与重复部分。
 */
export function partitionByExisting(
  domains: DomainItem[],
  existing: Set<string>
): PartitionResult {
  const seen = new Set(existing);
  const fresh: DomainItem[] = [];
  const duplicate: DomainItem[] = [];

  for (const domain of domains) {
    if (seen.has(domain.ascii)) {
      duplicate.push(domain);
      continue;
    }

    seen.add(domain.ascii);
    fresh.push(domain);
  }

  return { fresh, duplicate } satisfies PartitionResult;
}

/**
 * 规范化 TLD 输入，移除前导点并转换为小写。
 */
export function sanitizeTld(input: string): string {
  return input.trim().replace(/^\.+/, "").toLowerCase();
}
