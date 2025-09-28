import type {
  DomainItem,
  DomainNormalizationResult,
  DomainParseErrorCode,
  FileParseResult
} from "../types";

const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * 将一批域名进行归一化处理，输出合法、重复与无效列表。
 * @param input 字符串数组或文件解析结果
 */
export function normalizeDomains(input: string[] | FileParseResult): DomainNormalizationResult {
  const sources = Array.isArray(input) ? input : input.entries;
  const valid: DomainItem[] = [];
  const invalid: string[] = [];
  const duplicate: string[] = [];
  const seenAscii = new Set<string>();

  for (const raw of sources) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    const cleaned = stripExtras(trimmed);

    try {
      const ascii = toASCII(cleaned);
      const error = validateAsciiDomain(ascii);
      if (error) {
        invalid.push(trimmed);
        continue;
      }

      const asciiKey = ascii.toLowerCase();
      if (seenAscii.has(asciiKey)) {
        duplicate.push(cleaned);
        continue;
      }

      seenAscii.add(asciiKey);
      valid.push({
        display: cleaned,
        ascii: asciiKey,
        tld: extractTld(asciiKey)
      });
    } catch {
      invalid.push(trimmed);
    }
  }

  return { valid, invalid, duplicate } satisfies DomainNormalizationResult;
}

/**
 * 将域名中的协议、路径、末尾点等额外信息剥离。
 */
export function stripExtras(value: string): string {
  const withoutScheme = value
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/^\/{2}/, "")
    .trim();

  const hostPart = withoutScheme.split(/[/?#]/, 1)[0];
  return hostPart.replace(/\.$/, "");
}

/**
 * 将任意形式的域名转换为 ASCII。
 */
export function toASCII(domain: string): string {
  if (!domain) {
    throw new Error("invalid-format");
  }

  try {
    const url = new URL(`http://${domain}`);
    return url.hostname.replace(/\.$/, "").toLowerCase();
  } catch {
    throw new Error("invalid-format");
  }
}

/**
 * 校验 ASCII 域名是否符合 RFC 规范。
 */
export function validateAsciiDomain(ascii: string): DomainParseErrorCode | null {
  if (ascii.length < 1 || ascii.length > 253) {
    return "invalid-length";
  }

  if (!ascii.includes(".")) {
    return "no-tld";
  }

  if (ascii.startsWith("-") || ascii.endsWith("-")) {
    return "invalid-format";
  }

  if (ascii.includes("..")) {
    return "invalid-format";
  }

  const labels = ascii.split(".");
  for (const label of labels) {
    if (!LABEL_REGEX.test(label)) {
      return "invalid-format";
    }
  }

  return null;
}

/**
 * 根据 ASCII 域名提取顶级域。
 */
function extractTld(ascii: string): string | undefined {
  const index = ascii.lastIndexOf(".");
  if (index === -1 || index === ascii.length - 1) {
    return undefined;
  }
  return ascii.slice(index + 1);
}
