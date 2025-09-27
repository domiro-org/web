export type CheckState =
  | "idle"
  | "dns-checking"
  | "rdap-checking"
  | "done"
  | "error";

export type Verdict =
  | "available"
  | "taken"
  | "undetermined"
  | "rdap-unsupported";

export interface DomainCheckRow {
  id: string;
  domain: string;
  ascii: string;
  dns: "has-ns" | "no-ns" | "nxdomain" | "error";
  rdap: number | null;
  verdict: Verdict;
  detail?: string;
  tld: string;
}
