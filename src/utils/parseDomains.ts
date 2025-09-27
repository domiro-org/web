const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export type DomainParseErrorCode =
  | "invalid-format"
  | "invalid-length"
  | "no-tld"
  | "duplicate";

export interface DomainParseError {
  input: string;
  code: DomainParseErrorCode;
}

export interface ParsedDomain {
  id: string;
  domain: string;
  ascii: string;
  tld: string;
}

export interface DomainParseResult {
  domains: ParsedDomain[];
  errors: DomainParseError[];
}

/**
 * 解析用户输入的域名列表，完成去重、格式校验和 IDN -> ASCII 转换。
 * @param input 原始文本输入
 * @returns 包含合法域名数组与错误信息的对象
 */
export function parseDomains(input: string): DomainParseResult {
  const domains: ParsedDomain[] = [];
  const errors: DomainParseError[] = [];
  const seenAscii = new Set<string>();

  // 使用换行分割逐条处理，确保解析流程可控
  input
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((raw) => {
      try {
        const displayDomain = stripExtras(raw);
        const ascii = toASCII(displayDomain);

        // ASCII 作为唯一性判断依据
        if (seenAscii.has(ascii)) {
          errors.push({ input: raw, code: "duplicate" });
          return;
        }

        const domainValidation = validateAsciiDomain(ascii);
        if (domainValidation) {
          errors.push({ input: raw, code: domainValidation });
          return;
        }

        seenAscii.add(ascii);

        // 记录 TLD 方便后续路由不同查询服务
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

  return { domains, errors };
}

/**
 * 提取域名主体，去掉协议、路径等冗余信息。
 */
function stripExtras(value: string): string {
  // 去除协议 / 开头的双斜线
  const withoutScheme = value
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/^\/{2}/, "")
    .trim();

  // 取第一个路径/查询片段之前的部分
  const hostPart = withoutScheme.split(/[/?#]/, 1)[0];

  return hostPart.replace(/\.$/, "");
}

/**
 * 使用 URL API 将域名转换为 ASCII（punycode）。
 */
function toASCII(domain: string): string {
  if (!domain) {
    throw new Error("invalid-format");
  }

  // 使用 URL API 执行 IDNA 转换
  try {
    const url = new URL(`http://${domain}`);
    return url.hostname.replace(/\.$/, "").toLowerCase();
  } catch (error) {
    throw new Error("invalid-format");
  }
}

/**
 * 判断 ASCII 域名是否满足长度、字符和层级规则。
 */
function validateAsciiDomain(ascii: string): DomainParseErrorCode | null {
  // 主域长度限制
  if (ascii.length < 1 || ascii.length > 253) {
    return "invalid-length";
  }

  // 必须至少包含一个点，保证有 TLD
  if (!ascii.includes(".")) {
    return "no-tld";
  }

  if (ascii.startsWith("-") || ascii.endsWith("-")) {
    return "invalid-format";
  }

  if (ascii.includes("..")) {
    return "invalid-format";
  }

  // 逐个标签校验合法字符和长度
  const labels = ascii.split(".");
  for (const label of labels) {
    if (!LABEL_REGEX.test(label)) {
      return "invalid-format";
    }
  }

  return null;
}
