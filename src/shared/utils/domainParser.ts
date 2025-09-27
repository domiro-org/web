import type {
  DomainParseErrorCode,
  DomainParseResult,
  ParsedDomain
} from "../types";

const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * 解析用户输入的域名单行文本，完成去重与校验。
 * @param input 原始文本输入
 * @returns 包含合法域名与错误列表的结构
 */
export function parseDomains(input: string): DomainParseResult {
  const domains: ParsedDomain[] = [];
  const errors: DomainParseResult["errors"] = [];
  const seenAscii = new Set<string>();

  input
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((raw) => {
      try {
        const displayDomain = stripExtras(raw);
        const ascii = toASCII(displayDomain);

        if (seenAscii.has(ascii)) {
          errors.push({ input: raw, code: "duplicate" });
          return;
        }

        const validation = validateAsciiDomain(ascii);
        if (validation) {
          errors.push({ input: raw, code: validation });
          return;
        }

        seenAscii.add(ascii);

        const tld = ascii.substring(ascii.lastIndexOf(".") + 1);
        domains.push({
          id: crypto.randomUUID(),
          domain: displayDomain,
          ascii,
          tld
        });
      } catch {
        errors.push({ input: raw, code: "invalid-format" });
      }
    });

  return { domains, errors } satisfies DomainParseResult;
}

/**
 * 去除域名中的协议、路径、结尾点等噪声。
 */
function stripExtras(value: string): string {
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
function toASCII(domain: string): string {
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
 * 校验 ASCII 域名是否符合 RFC 限制。
 */
function validateAsciiDomain(ascii: string): DomainParseErrorCode | null {
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
