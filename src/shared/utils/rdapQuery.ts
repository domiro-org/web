import type { RdapCheckResult } from "../types";

import { delay } from "./async";

const RDAP_BASE_ENDPOINT = "https://rdap.org/domain/";

interface RdapQueryOptions {
  /** 是否通过代理请求 RDAP */
  useProxy?: boolean;
}

interface RdapRetryOptions extends RdapQueryOptions {
  /** 最大自动重试次数（包含首次调用） */
  attempts?: number;
  /** 每轮基础等待时间（毫秒），将按尝试次数线性递增 */
  delayMs?: number;
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
 * 在 RDAP 查询基础上增加自动重试逻辑，对 429/网络错误进行退避重试。
 * @param domain ASCII 域名
 * @param options 代理与重试配置
 */
export async function runRdapQueryWithRetry(
  domain: string,
  options?: RdapRetryOptions
): Promise<RdapCheckResult> {
  const { attempts: attemptOverride, delayMs: delayOverride, ...queryOptions } = options ?? {};
  const attempts = Math.max(attemptOverride ?? 3, 1);
  const baseDelay = Math.max(delayOverride ?? 1000, 0);
  let lastError: unknown;
  let lastResult: RdapCheckResult | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await runRdapQuery(domain, queryOptions);
      if (result.status === 429 && attempt < attempts) {
        lastResult = result;
        const retryAfterRaw = result.detailParams?.retryAfter;
        // 如果 Retry-After 可解析为数字，则优先使用服务端建议的等待秒数
        const retryAfterSeconds =
          typeof retryAfterRaw === "number"
            ? retryAfterRaw
            : typeof retryAfterRaw === "string"
              ? Number.parseFloat(retryAfterRaw)
              : Number.NaN;
        const waitMs =
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : baseDelay * attempt;
        await delay(waitMs);
        continue;
      }
      return result;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        throw error;
      }
      await delay(baseDelay * attempt);
    }
  }

  if (lastResult) {
    return lastResult;
  }

  throw lastError ?? new Error("RDAP query failed");
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
