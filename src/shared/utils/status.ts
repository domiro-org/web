import type { ChipProps } from "@mui/material/Chip";

import type { DnsPrecheckStatus, Verdict } from "../types";

interface StatusChipMeta {
  labelKey: string;
  color: ChipProps["color"];
  variant?: ChipProps["variant"];
}

/**
 * 将 DNS 预筛状态映射为 Chip 外观配置。
 */
export function dnsStatusToChipProps(status: DnsPrecheckStatus): StatusChipMeta {
  switch (status) {
    case "has-ns":
      return { labelKey: "dns.status.has-ns", color: "success", variant: "filled" };
    case "nxdomain":
      return { labelKey: "dns.status.nxdomain", color: "warning", variant: "filled" };
    case "no-ns":
      return { labelKey: "dns.status.no-ns", color: "default", variant: "outlined" };
    case "error":
    default:
      return { labelKey: "dns.status.error", color: "default", variant: "outlined" };
  }
}

/**
 * 将 RDAP / 预判状态映射为 Chip 外观，统一视觉语义。
 */
export function verdictToChipProps(verdict: Verdict): StatusChipMeta {
  switch (verdict) {
    case "available":
      return { labelKey: "verdict.available", color: "success", variant: "filled" };
    case "taken":
      return { labelKey: "verdict.taken", color: "error", variant: "filled" };
    case "rdap-unsupported":
      return { labelKey: "verdict.rdap-unsupported", color: "default", variant: "outlined" };
    case "undetermined":
    default:
      return { labelKey: "verdict.undetermined", color: "warning", variant: "outlined" };
  }
}
