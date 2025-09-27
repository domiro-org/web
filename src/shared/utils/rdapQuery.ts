import type { RdapCheckResult } from "../types";

const RDAP_BASE_ENDPOINT = "https://rdap.org/domain/";

interface RdapQueryOptions {
  /** 是否通过代理请求 RDAP */
  useProxy?: boolean;
}

interface RdapSuccessResponse {
  objectClassName?: string;
  status?: string[];
}

/**
 * 解析 Retry-After 头部返回等待秒数。
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
 * 调用 RDAP.org 查询域名注册状态并返回标准化结果。
 * @param domain ASCII 形式的域名
 * @returns RDAP 查询结果结构
 */
export async function runRdapQuery(
  domain: string,
  options?: RdapQueryOptions
): Promise<RdapCheckResult> {
  const url = resolveEndpoint(domain, options?.useProxy);

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

/**
 * 根据设置决定 RDAP 请求的实际端点。
 */
function resolveEndpoint(domain: string, useProxy?: boolean): string {
  if (useProxy) {
    const proxyBase = import.meta.env.VITE_API_PROXY;
    if (proxyBase) {
      const normalized = proxyBase.endsWith("/") ? proxyBase.slice(0, -1) : proxyBase;
      return `${normalized}/rdap?domain=${encodeURIComponent(domain)}`;
    }
  }

  return `${RDAP_BASE_ENDPOINT}${encodeURIComponent(domain)}`;
}
