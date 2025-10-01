import type {
  DnsPrecheckResult,
  DnsPrecheckStatus,
  DohProviderId
} from "../types";

import { delay } from "./async";

const NS_RECORD_TYPE = 2;
const SOA_RECORD_TYPE = 6;

const DOH_PROVIDERS: Array<{ id: DohProviderId; endpoint: string }> = [
  { id: "google", endpoint: "https://dns.google/resolve" },
  { id: "cloudflare", endpoint: "https://cloudflare-dns.com/dns-query" }
];

const DOH_PROVIDER_MAP = new Map<DohProviderId, { id: DohProviderId; endpoint: string }>(
  DOH_PROVIDERS.map((provider) => [provider.id, provider])
);

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
  Authority?: DohAnswer[];
}

type SupportedRecord = "NS" | "SOA";

/**
 * 使用 Google/Cloudflare DoH 查询域名的 NS/SOA 记录并判断委派状态。
 * @param domain ASCII 形式的域名
 * @returns DNS 预检查结果
 */
export async function runDohQuery(
  domain: string,
  preferredProviders?: DohProviderId[]
): Promise<DnsPrecheckResult> {
  let lastDetail: string | undefined;

  const providerSequence = buildProviderSequence(preferredProviders);

  // 依次尝试多个 DoH 服务，避免单点失败
  for (const provider of providerSequence) {
    try {
      const nsResponse = await requestDohRecord(provider.endpoint, domain, "NS");
      const nsStatus = interpretNsResponse(nsResponse);

      if (nsStatus === "has-ns") {
        return { status: "has-ns", provider: provider.id };
      }

      if (nsStatus === "nxdomain") {
        return { status: "nxdomain", provider: provider.id };
      }

      if (nsStatus === "no-ns") {
        const soaResponse = await requestDohRecord(
          provider.endpoint,
          domain,
          "SOA"
        );
        const soaHasRecord = hasRecordOfType(soaResponse, SOA_RECORD_TYPE);

        if (soaResponse.Status === 3) {
          return { status: "nxdomain", provider: provider.id };
        }

        if (soaHasRecord) {
          return { status: "has-ns", provider: provider.id };
        }

        return { status: "no-ns", provider: provider.id };
      }

      lastDetail = "dns.detail.unexpected-status";
    } catch (error) {
      console.error("DoH request failed", error);
      lastDetail = "dns.detail.network-error";
    }
  }

  return {
    status: "error",
    provider: null,
    detail: lastDetail ?? "dns.detail.unknown-error"
  } satisfies DnsPrecheckResult;
}

interface DohRetryOptions {
  /** 最大自动重试次数（包含首次尝试） */
  attempts?: number;
  /** 基础退避时间，单位毫秒 */
  delayMs?: number;
}

/**
 * 对 DoH 查询结果提供自动重试能力，避免短暂抖动导致整体失败。
 * @param domain ASCII 形式的域名
 * @param preferredProviders 用户选择的 DoH 服务顺序
 * @param options 重试参数
 */
export async function runDohQueryWithRetry(
  domain: string,
  preferredProviders?: DohProviderId[],
  options?: DohRetryOptions
): Promise<DnsPrecheckResult> {
  const attempts = Math.max(options?.attempts ?? 3, 1);
  const baseDelay = Math.max(options?.delayMs ?? 400, 0);
  let lastError: unknown;
  let lastResult: DnsPrecheckResult | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await runDohQuery(domain, preferredProviders);
      if (result.status === "error" && attempt < attempts) {
        lastResult = result;
        await delay(baseDelay * attempt);
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

  throw lastError ?? new Error("DoH query failed");
}

/**
 * 根据用户偏好构建 DoH 调用顺序。
 */
function buildProviderSequence(preferredProviders?: DohProviderId[]) {
  const ids = preferredProviders && preferredProviders.length > 0
    ? preferredProviders
    : DOH_PROVIDERS.map((provider) => provider.id);

  const uniqueIds = Array.from(new Set(ids));
  return uniqueIds
    .map((id) => DOH_PROVIDER_MAP.get(id))
    .filter((item): item is { id: DohProviderId; endpoint: string } => Boolean(item));
}

/**
 * 请求指定类型的 DoH 资源并返回解析后的 JSON 数据。
 */
async function requestDohRecord(
  endpoint: string,
  domain: string,
  record: SupportedRecord
): Promise<DohResponse> {
  const url = new URL(endpoint);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", record);
  url.searchParams.set("cd", "0");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/dns-json" }
  });

  if (!response.ok) {
    throw new Error(`DoH HTTP ${response.status}`);
  }

  return (await response.json()) as DohResponse;
}

/**
 * 根据 DoH JSON 判断 NS 查询结果对应的语义。
 */
function interpretNsResponse(response: DohResponse): DnsPrecheckStatus {
  if (response.Status === 3) {
    return "nxdomain";
  }

  if (response.Status === 0) {
    const hasNsRecord = hasRecordOfType(response, NS_RECORD_TYPE);
    return hasNsRecord ? "has-ns" : "no-ns";
  }

  return "error";
}

/**
 * 判断应答中是否存在指定类型的记录。
 */
function hasRecordOfType(response: DohResponse, targetType: number): boolean {
  const answerRecords = response.Answer ?? [];
  const authorityRecords = response.Authority ?? [];
  const allRecords = [...answerRecords, ...authorityRecords];

  return allRecords.some((record) => record.type === targetType);
}
