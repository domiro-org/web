import type { DomainCheckRow, DomainItem, RdapCheckResult, Verdict } from "../types";

/**
 * 判断 DNS 状态是否需要执行 RDAP 兜底。
 * @param status DNS 阶段输出
 */
export function shouldRunRdap(status: DomainCheckRow["dns"]): boolean {
  // DNS 查询失败时同样进入 RDAP 兜底，避免遗漏可注册域
  return status === "no-ns" || status === "nxdomain" || status === "error";
}

/**
 * 根据 DNS 状态推导初步结论。
 * @param status DNS 状态
 */
export function deriveDnsVerdict(status: DomainCheckRow["dns"]): Verdict {
  if (status === "has-ns") {
    return "taken";
  }
  if (status === "error") {
    return "undetermined";
  }
  return "available";
}

/**
 * 合并多段详情文案，使用居中点分隔。
 */
export function mergeDetails(
  baseDetail?: string,
  appendDetail?: string
): string | undefined {
  if (baseDetail && appendDetail) {
    return `${baseDetail} · ${appendDetail}`;
  }
  return appendDetail ?? baseDetail;
}

/**
 * 综合 DNS 与 RDAP 结果得出最终结论。
 */
export function deriveVerdictWithRdap(
  status: DomainCheckRow["dns"],
  rdap: RdapCheckResult | null
): Verdict {
  if (rdap === null) {
    if (status === "has-ns") {
      return "taken";
    }
    if (status === "error") {
      return "undetermined";
    }
    return "undetermined";
  }

  if (rdap.unsupported) {
    return "rdap-unsupported";
  }

  if (rdap.available === true) {
    return "available";
  }

  if (rdap.available === false) {
    return "taken";
  }

  if (rdap.status === 429) {
    return "undetermined";
  }

  return deriveDnsVerdict(status);
}

/**
 * 根据解析结果创建 DNS 表格初始行。
 */
export function buildInitialRows(domains: DomainItem[]): DomainCheckRow[] {
  return domains.map((domain) => ({
    id: domain.ascii,
    domain: domain.display,
    ascii: domain.ascii,
    tld: domain.tld ?? (domain.ascii.includes(".") ? domain.ascii.split(".").pop() ?? "" : ""),
    dns: "error",
    rdap: null,
    verdict: "undetermined"
  }));
}
