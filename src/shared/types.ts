/**
 * 描述单条域名校验错误。
 */
export interface DomainParseError {
  /** 原始用户输入 */
  input: string;
  /** 错误类型代码 */
  code: DomainParseErrorCode;
}

/**
 * 域名解析错误的类型集合。
 */
export type DomainParseErrorCode =
  | "invalid-format"
  | "invalid-length"
  | "no-tld"
  | "duplicate";

/**
 * 经过解析后的域名实体。
 */
export interface ParsedDomain {
  /** 域名唯一标识 */
  id: string;
  /** 原始展示形态 */
  domain: string;
  /** ASCII 形式 */
  ascii: string;
  /** 顶级域字符串 */
  tld: string;
}

/**
 * 域名解析结果集合。
 */
export interface DomainParseResult {
  /** 通过校验的域名数组 */
  domains: ParsedDomain[];
  /** 所有校验错误 */
  errors: DomainParseError[];
}

/**
 * DNS over HTTPS 服务提供者标识。
 */
export type DohProviderId = "google" | "cloudflare";

/**
 * 应用级运行配置。
 */
export interface AppSettings {
  /** RDAP 查询最大并发数 */
  rdapConcurrency: number;
  /** DoH 查询使用的提供者顺序 */
  dohProviders: DohProviderId[];
  /** 是否通过代理中转网络请求 */
  useProxy: boolean;
  /** 是否对不支持 RDAP 的 TLD 启用 WHOIS 兜底 */
  enableWhoisFallback: boolean;
}

/**
 * DNS 预检查的状态语义。
 */
export type DnsPrecheckStatus = "has-ns" | "no-ns" | "nxdomain" | "error";

/**
 * DNS 预检查的返回结构。
 */
export interface DnsPrecheckResult {
  /** 最终预判状态 */
  status: DnsPrecheckStatus;
  /** 实际响应的 DoH 服务 */
  provider: DohProviderId | null;
  /** 可选的错误详情 key */
  detail?: string;
}

/**
 * RDAP 查询返回的关键信息。
 */
export interface RdapCheckResult {
  /** HTTP 状态码 */
  status: number;
  /** 是否确认可注册 */
  available: boolean | null;
  /** 服务是否不支持该域名 */
  unsupported?: boolean;
  /** i18n 详情 key */
  detailKey: string;
  /** 详情参数 */
  detailParams?: Record<string, string | number>;
}

/**
 * 综合 DNS + RDAP 的判断结论。
 */
export type Verdict =
  | "available"
  | "taken"
  | "undetermined"
  | "rdap-unsupported";

/**
 * 单行查询结果数据结构。
 */
export interface DomainCheckRow {
  /** 对应的域名 ID */
  id: string;
  /** 原始域名 */
  domain: string;
  /** ASCII 域名 */
  ascii: string;
  /** 顶级域标识 */
  tld: string;
  /** DNS 预判状态 */
  dns: DnsPrecheckStatus;
  /** RDAP 返回状态码 */
  rdap: number | null;
  /** 综合判断 */
  verdict: Verdict;
  /** 详情文案 */
  detail?: string;
}

/**
 * 查询整体阶段状态。
 */
export type CheckStage =
  | "idle"
  | "dns-checking"
  | "rdap-checking"
  | "done"
  | "error";

/**
 * Snackbar UI 状态。
 */
export interface SnackbarState {
  /** MUI severity */
  severity: "success" | "info" | "warning" | "error";
  /** i18n 消息 key */
  messageKey: string;
  /** 补充分参数 */
  messageParams?: Record<string, string | number>;
}

/**
 * App 全局状态树。
 */
export interface AppState {
  /** 运行设置 */
  settings: AppSettings;
  /** 输入页状态 */
  input: {
    /** 当前文本 */
    value: string;
    /** 上次解析结果 */
    parsed: DomainParseResult;
    /** 最后一次保存时间戳 */
    updatedAt: number;
  };
  /** DNS 页状态 */
  dns: {
    /** 当前阶段 */
    stage: CheckStage;
    /** 查询行数据 */
    rows: DomainCheckRow[];
    /** 最近错误 key */
    errorKey: string | null;
    /** 并发 run ID */
    runId: number;
    /** 已完成 DNS 查询的时间 */
    completedAt: number | null;
  };
  /** RDAP 页状态 */
  rdap: {
    /** 已完成 RDAP 的数量 */
    checkedCount: number;
    /** 是否仍在运行 */
    running: boolean;
    /** 最近错误 key */
    errorKey: string | null;
  };
  /** 全局 UI 状态 */
  ui: {
    /** 通知条 */
    snackbar: SnackbarState | null;
  };
}

/**
 * Reducer 可用的动作类型。
 */
export type AppAction =
  | { type: "input/set"; payload: { value: string; parsed: DomainParseResult } }
  | { type: "dns/start"; payload: { runId: number } }
  | { type: "dns/success"; payload: { rows: DomainCheckRow[]; runId: number } }
 | { type: "dns/error"; payload: { messageKey: string; runId: number } }
  | { type: "rdap/start" }
  | { type: "rdap/update"; payload: { rows: DomainCheckRow[]; checked: number } }
  | { type: "rdap/error"; payload: { messageKey: string } }
  | { type: "process/reset" }
  | { type: "process/complete"; payload?: { rows?: DomainCheckRow[] } }
  | { type: "settings/update"; payload: Partial<AppSettings> }
  | { type: "ui/snackbar"; payload: SnackbarState | null };

/**
 * sessionStorage 中持久化的键名。
 */
export const SESSION_STORAGE_KEY = "domiro.app.state" as const;

/**
 * localStorage 中持久化设置的键名。
 */
export const SETTINGS_STORAGE_KEY = "domiro.app.settings" as const;
