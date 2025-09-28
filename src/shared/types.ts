/**
 * 域名条目结构，保存展示与 ASCII 形式。
 */
export interface DomainItem {
  /** 原始展示（可能为 IDN） */
  display: string;
  /** punycode 转换后的 ASCII */
  ascii: string;
  /** 顶级域，可选字段方便后续扩展 */
  tld?: string;
}

/**
 * 域名归一化过程中的错误类型。
 */
export type DomainParseErrorCode =
  | "invalid-format"
  | "invalid-length"
  | "no-tld"
  | "duplicate";

/**
 * 记录单条校验失败的域名及原因。
 */
export interface DomainParseError {
  /** 用户原始输入 */
  input: string;
  /** 错误代码 */
  code: DomainParseErrorCode;
}

/**
 * 文件解析的统一结果结构。
 */
export interface FileParseResult {
  /** 解析出的所有文本条目 */
  entries: string[];
  /** 总行数（包含空行） */
  totalLines: number;
  /** 文件体积（字节） */
  fileSize: number;
  /** 可选：列名信息（CSV 使用） */
  headers?: string[];
  /** CSV 行数据（按列切分） */
  rows?: string[][];
  /** 实际使用的分隔符 */
  delimiter?: "," | ";" | "\t";
}

/**
 * 域名归一化的统一返回值。
 */
export interface DomainNormalizationResult {
  /** 通过校验的域名集合 */
  valid: DomainItem[];
  /** 被认定为重复的原始条目 */
  duplicate: string[];
  /** 无法通过校验的原始条目 */
  invalid: string[];
}

/**
 * 输入模块在全局状态中的结构。
 */
export interface InputState {
  /** 当前已收集的域名列表 */
  domains: DomainItem[];
  /** 最近一次更新的时间戳 */
  updatedAt: number;
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
  input: InputState;
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
    /** 总待查询的域名数量 */
    totalCount: number;
    /** 已完成查询的域名数量 */
    completedCount: number;
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
  | { type: "input/setDomains"; payload: { domains: DomainItem[] } }
  | { type: "input/appendDomains"; payload: { domains: DomainItem[] } }
  | { type: "input/clear" }
  | { type: "dns/start"; payload: { runId: number; total: number } }
  | { type: "dns/progress"; payload: { runId: number; completed: number } }
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
