const RDAP_BASE_ENDPOINT = "https://rdap.org/domain/";

interface RdapSuccessResponse {
  objectClassName?: string;
  status?: string[];
}

export interface RdapCheckResult {
  status: number;
  available: boolean | null;
  unsupported?: boolean;
  detailKey: string;
  detailParams?: Record<string, string | number>;
}

/**
 * 解析 Retry-After 头部，返回重试等待秒数。
 * @param value HTTP 头部 Retry-After 的原始值
 * @returns 解析出的秒数，解析失败返回 undefined
 */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const numericValue = Number(value);

  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  const dateValue = Date.parse(value);
  if (!Number.isNaN(dateValue)) {
    const deltaMs = dateValue - Date.now();
    if (deltaMs > 0) {
      return Math.round(deltaMs / 1000);
    }
  }

  return undefined;
}

/**
 * 调用公共 RDAP 聚合端点获取域名的注册状态信息。
 * @param domain ASCII 形态的域名
 * @returns 描述 RDAP 查询结果的对象
 */
export async function runRdapCheck(domain: string): Promise<RdapCheckResult> {
  // RDAP.org 聚合了绝大多数 gTLD 的查询入口，M1 再补完整路由
  const url = `${RDAP_BASE_ENDPOINT}${encodeURIComponent(domain)}`;

  const response = await fetch(url, {
    headers: { Accept: "application/rdap+json, application/json" }
  });

  if (response.status === 404) {
    return {
      status: 404,
      available: true,
      detailKey: "rdap.detail.status-404"
    } satisfies RdapCheckResult;
  }

  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    return {
      status: 429,
      available: null,
      detailKey: retryAfter
        ? "rdap.detail.status-429-wait"
        : "rdap.detail.status-429",
      detailParams: retryAfter ? { retryAfter } : undefined
    } satisfies RdapCheckResult;
  }

  if (response.status === 200) {
    const data = (await response.json()) as RdapSuccessResponse;
    const isDomainObject = data.objectClassName === "domain";

    return {
      status: 200,
      available: isDomainObject ? false : null,
      detailKey: isDomainObject
        ? "rdap.detail.status-200"
        : "rdap.detail.unexpected-object"
    } satisfies RdapCheckResult;
  }

  if (response.status === 501 || response.status === 400 || response.status === 405) {
    return {
      status: response.status,
      available: null,
      unsupported: true,
      detailKey: "rdap.detail.unsupported"
    } satisfies RdapCheckResult;
  }

  if (response.status >= 500) {
    return {
      status: response.status,
      available: null,
      detailKey: "rdap.detail.server-error",
      detailParams: { status: response.status }
    } satisfies RdapCheckResult;
  }

  return {
    status: response.status,
    available: null,
    detailKey: "rdap.detail.http-error",
    detailParams: { status: response.status }
  } satisfies RdapCheckResult;
}
