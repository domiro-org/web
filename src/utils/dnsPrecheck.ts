const NS_RECORD_TYPE = 2;
const SOA_RECORD_TYPE = 6;

const DOH_PROVIDERS = [
  { id: "google", endpoint: "https://dns.google/resolve" },
  { id: "cloudflare", endpoint: "https://cloudflare-dns.com/dns-query" }
] as const;

export type DohProviderId = (typeof DOH_PROVIDERS)[number]["id"];

export type DnsPrecheckStatus = "has-ns" | "no-ns" | "nxdomain" | "error";

export interface DnsPrecheckResult {
  status: DnsPrecheckStatus;
  provider: DohProviderId | null;
  detail?: string;
}

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
 * 使用 DoH 服务查询指定域名的 NS/SOA 记录并返回预判结果。
 * @param domain ASCII 形态的域名
 * @returns DNS 委派状态结果
 */
export async function runDnsPrecheck(domain: string): Promise<DnsPrecheckResult> {
  let lastDetail: string | undefined;

  // 依次尝试 Google 和 Cloudflare，避免单一服务波动
  for (const provider of DOH_PROVIDERS) {
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
        // NS 记录缺失时补查 SOA，确认是否存在正向区域
        const soaResponse = await requestDohRecord(provider.endpoint, domain, "SOA");
        const soaHasRecord = hasRecordOfType(soaResponse, SOA_RECORD_TYPE);

        if (soaResponse.Status === 3) {
          return { status: "nxdomain", provider: provider.id };
        }

        if (soaHasRecord) {
          return { status: "has-ns", provider: provider.id };
        }

        return { status: "no-ns", provider: provider.id };
      }

      // 其他 RCODE 统一视作错误，尝试下一家 DoH 服务
      lastDetail = "dns.detail.unexpected-status";
    } catch (error) {
      console.error("DoH request failed", error);
      lastDetail = "dns.detail.network-error";
      continue;
    }
  }

  return {
    status: "error",
    provider: null,
    detail: lastDetail ?? "dns.detail.unknown-error"
  };
}

/**
 * 构造 DoH 查询请求并返回 JSON 结果。
 */
async function requestDohRecord(
  endpoint: string,
  domain: string,
  record: SupportedRecord
): Promise<DohResponse> {
  // 使用标准 application/dns-json 接口获取结构化响应
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

  const data = (await response.json()) as DohResponse;
  return data;
}

/**
 * 判断 NS 查询结果的语义。
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
 * 检查 Answer/Authority 区域是否包含目标类型记录。
 */
function hasRecordOfType(response: DohResponse, targetType: number): boolean {
  // 某些 DoH 服务可能把权威应答放在 Authority 区块，需要一并判断
  const answerRecords = response.Answer ?? [];
  const authorityRecords = response.Authority ?? [];
  const allRecords = [...answerRecords, ...authorityRecords];

  return allRecords.some((record) => record.type === targetType);
}
