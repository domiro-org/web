import type { RdapCheckResult } from "../types";

import { delay } from "./async";

const IANA_RDAP_BOOTSTRAP_ENDPOINT = "https://data.iana.org/rdap/dns.json";

interface RdapRetryOptions {
  /** 最大自动重试次数（包含首次调用） */
  attempts?: number;
  /** 每轮基础等待时间（毫秒），将按尝试次数线性递增 */
  delayMs?: number;
}

interface RdapSuccessResponse {
  objectClassName?: string;
  status?: string[];
}

interface RdapEndpointCandidate {
  url: string;
  serviceDisplay: string | null;
}

type RdapBootstrapService = [string[], string[]];

interface RdapBootstrapFile {
  services: RdapBootstrapService[];
}

type RdapServiceIndex = Map<string, string[]>;

let rdapServiceIndexPromise: Promise<RdapServiceIndex> | null = null;

/**
 * 调用 TLD 对应的 RDAP 服务查询域名注册状态并返回标准化结果。
 * @param domain ASCII 形式的域名
 * @returns RDAP 查询结果结构
 */
export async function runRdapQuery(domain: string): Promise<RdapCheckResult> {
  const candidates = await resolveEndpointCandidates(domain);

  if (candidates.length === 0) {
    return {
      status: 0,
      available: null,
      unsupported: true,
      detailKey: "rdap.detail.bootstrap-missing"
    } satisfies RdapCheckResult;
  }

  let lastNetworkError: unknown;
  let lastFailedResult: RdapCheckResult | null = null;

  for (const candidate of candidates) {
    try {
      // 逐个尝试候选 RDAP 端点，遇到网络错误则切换下一项
      const response = await fetch(candidate.url, {
        headers: { Accept: "application/rdap+json, application/json" }
      });

      if (response.status === 404) {
        return {
          status: 404,
          available: true,
          detailKey: "rdap.detail.status-404",
          serviceUrl: candidate.serviceDisplay ?? undefined
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
          detailParams: retryAfter ? { retryAfter } : undefined,
          serviceUrl: candidate.serviceDisplay ?? undefined
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
            : "rdap.detail.unexpected-object",
          serviceUrl: candidate.serviceDisplay ?? undefined
        } satisfies RdapCheckResult;
      }

      if (response.status === 501 || response.status === 400 || response.status === 405) {
        lastFailedResult = {
          status: response.status,
          available: null,
          unsupported: true,
          detailKey: "rdap.detail.unsupported",
          serviceUrl: candidate.serviceDisplay ?? undefined
        } satisfies RdapCheckResult;
        continue;
      }

      if (response.status >= 500) {
        lastFailedResult = {
          status: response.status,
          available: null,
          detailKey: "rdap.detail.server-error",
          detailParams: { status: response.status },
          serviceUrl: candidate.serviceDisplay ?? undefined
        } satisfies RdapCheckResult;
        continue;
      }

      lastFailedResult = {
        status: response.status,
        available: null,
        detailKey: "rdap.detail.http-error",
        detailParams: { status: response.status },
        serviceUrl: candidate.serviceDisplay ?? undefined
      } satisfies RdapCheckResult;
      // 若返回状态不在预期范围内，尝试下一个候选端点
      continue;
    } catch (error) {
      lastNetworkError = error;
      // 记录最后一次网络异常并继续尝试后续端点
    }
  }

  if (lastNetworkError) {
    throw lastNetworkError;
  }

  if (lastFailedResult) {
    return lastFailedResult;
  }

  throw new Error("RDAP query failed");
}

/**
 * 在 RDAP 查询基础上增加自动重试逻辑，对 429/网络错误进行退避重试。
 * @param domain ASCII 域名
 * @param options 重试配置
 */
export async function runRdapQueryWithRetry(
  domain: string,
  options?: RdapRetryOptions
): Promise<RdapCheckResult> {
  const { attempts: attemptOverride, delayMs: delayOverride } = options ?? {};
  const attempts = Math.max(attemptOverride ?? 3, 1);
  const baseDelay = Math.max(delayOverride ?? 1000, 0);
  let lastError: unknown;
  let lastResult: RdapCheckResult | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await runRdapQuery(domain);
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
 * 根据设置决定 RDAP 请求的实际端点列表。
 */
async function resolveEndpointCandidates(domain: string): Promise<RdapEndpointCandidate[]> {
  const tld = extractTld(domain);
  if (!tld) {
    return [];
  }

  const index = await loadRdapServiceIndex();
  const serviceUrls = index.get(tld);

  if (!serviceUrls || serviceUrls.length === 0) {
    return [];
  }

  // 直接访问各个 RDAP 服务端点
  return serviceUrls.map((serviceUrl) => ({
    url: buildDomainQueryUrl(serviceUrl, domain),
    serviceDisplay: formatServiceDisplay(serviceUrl)
  }));
}

/**
 * 加载并缓存 IANA RDAP 引导文件，返回按 TLD 索引的服务列表。
 */
async function loadRdapServiceIndex(): Promise<RdapServiceIndex> {
  if (!rdapServiceIndexPromise) {
    rdapServiceIndexPromise = fetch(IANA_RDAP_BOOTSTRAP_ENDPOINT)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load RDAP bootstrap: ${response.status}`);
        }
        const data = (await response.json()) as RdapBootstrapFile;
        const index: RdapServiceIndex = new Map();

        // 遍历所有服务记录，将 TLD 映射到其对应的 RDAP 服务地址列表
        for (const [tlds, urls] of data.services) {
          for (const rawTld of tlds) {
            index.set(rawTld.toLowerCase(), urls);
          }
        }

        return index;
      })
      .catch((error) => {
        rdapServiceIndexPromise = null;
        throw error;
      });
  }

  return rdapServiceIndexPromise;
}

/**
 * 构造指定 RDAP 服务的 domain 查询 URL。
 */
function buildDomainQueryUrl(serviceUrl: string, domain: string): string {
  const normalized = serviceUrl.endsWith("/") ? serviceUrl : `${serviceUrl}/`;
  return `${normalized}domain/${encodeURIComponent(domain)}`;
}

/**
 * 解析域名提取 TLD（转为小写）。
 */
function extractTld(domain: string): string | null {
  const parts = domain.toLowerCase().split(".");
  if (parts.length === 0) {
    return null;
  }
  const last = parts[parts.length - 1];
  return last || null;
}

/**
 * 将 RDAP 服务地址格式化为可读展示内容。
 */
function formatServiceDisplay(serviceUrl: string): string | null {
  try {
    const parsed = new URL(serviceUrl);
    return parsed.host || serviceUrl;
  } catch (error) {
    // 若解析失败则退回原始地址
    return serviceUrl || null;
  }
}
