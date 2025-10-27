import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch
} from "react";

import type { PropsWithChildren } from "react";
import {
  type AppAction,
  type AppSettings,
  type AppState,
  type DomainItem,
  type InputState,
  SESSION_STORAGE_KEY,
  SETTINGS_STORAGE_KEY
} from "../types";

const defaultSettings: AppSettings = {
  rdapConcurrency: 3,
  dnsConcurrency: 1000,
  dohProviders: ["google", "cloudflare"]
};

const defaultState: AppState = {
  settings: { ...defaultSettings },
  input: {
    domains: [],
    updatedAt: 0
  },
  dns: {
    stage: "idle",
    rows: [],
    errorKey: null,
    runId: 0,
    completedAt: null,
    totalCount: 0,
    completedCount: 0
  },
  rdap: {
    checkedCount: 0,
    totalCount: 0,
    running: false,
    errorKey: null
  },
  ui: {
    snackbar: null
  }
};

const AppStateContext = createContext<AppState>(defaultState);
const AppDispatchContext = createContext<Dispatch<AppAction>>(() => {
  // Provider 外调用时抛错引导修复
  throw new Error("useAppDispatch must be used within AppStateProvider");
});

/**
 * 单个批次允许持久化的最大域名数量，用于控制切片粒度。
 */
export const PERSIST_INPUT_DOMAIN_THRESHOLD = 50_000;

/**
 * 单个批次允许持久化的最大字符串长度，尽量避免触发配额。
 */
export const PERSIST_INPUT_PAYLOAD_THRESHOLD = 2.5 * 1024 * 1024;

/**
 * 批次数据在 sessionStorage 中的键名前缀。
 */
const PERSIST_INPUT_CHUNK_PREFIX = `${SESSION_STORAGE_KEY}:chunk:`;

/**
 * sessionStorage 元数据版本号，用于兼容历史结构。
 */
const PERSIST_INPUT_VERSION = 2;

/**
 * 描述批次持久化的元数据结构。
 */
interface PersistedInputMetadataV2 {
  version: typeof PERSIST_INPUT_VERSION;
  updatedAt: number;
  totalCount: number;
  chunkCount: number;
}

/**
 * 描述批次数据的存储结构。
 */
interface PersistedInputChunk {
  domains: DomainItem[];
}

/**
 * 将输入状态持久化到 sessionStorage，避免刷新丢失。
 */
export function persistInput(value: AppState["input"]): void {
  if (typeof window === "undefined") {
    return;
  }

  const storage = window.sessionStorage;
  const existingMetadata = storage.getItem(SESSION_STORAGE_KEY);
  const previousChunkCount = getPersistedChunkCount(existingMetadata);
  const chunkPayloads = buildInputChunks(value.domains);

  const chunkBackups: Array<{ key: string; value: string | null }> = [];

  try {
    chunkPayloads.forEach((payload, index) => {
      const key = getChunkStorageKey(index);
      const previousValue = storage.getItem(key);

      chunkBackups.push({
        key,
        value: previousValue
      });

      storage.setItem(key, payload);
    });

    // 删除多余批次，避免旧数据占用空间
    for (let index = chunkPayloads.length; index < previousChunkCount; index += 1) {
      storage.removeItem(getChunkStorageKey(index));
    }

    const metadata: PersistedInputMetadataV2 = {
      version: PERSIST_INPUT_VERSION,
      updatedAt: value.updatedAt,
      totalCount: value.domains.length,
      chunkCount: chunkPayloads.length
    };

    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(metadata));
  } catch (error) {
    restoreChunksOnFailure(storage, chunkBackups);

    if (existingMetadata !== null) {
      storage.setItem(SESSION_STORAGE_KEY, existingMetadata);
    } else {
      storage.removeItem(SESSION_STORAGE_KEY);
    }

    if (isQuotaExceededError(error)) {
      // 写入失败时提示用户数据未能保存，但不中断页面逻辑
      console.warn("Failed to persist input due to sessionStorage quota", error);
      return;
    }

    throw error;
  }
}

/**
 * 计算批次数据在 sessionStorage 中的键名。
 */
function getChunkStorageKey(index: number): string {
  return `${PERSIST_INPUT_CHUNK_PREFIX}${index}`;
}

/**
 * 根据当前域名列表切分批次，并转换成存储所需的 JSON 字符串。
 */
function buildInputChunks(domains: DomainItem[]): string[] {
  const chunks = sliceDomains(domains);

  return chunks.map((chunk) =>
    JSON.stringify({
      domains: chunk
    } satisfies PersistedInputChunk)
  );
}

/**
 * 递归切分域名列表，保证每个批次满足阈值要求。
 */
function sliceDomains(domains: DomainItem[]): DomainItem[][] {
  if (domains.length === 0) {
    return [];
  }

  const serializedLength = JSON.stringify({ domains }).length;
  const withinDomainLimit = domains.length <= PERSIST_INPUT_DOMAIN_THRESHOLD;
  const withinPayloadLimit = serializedLength <= PERSIST_INPUT_PAYLOAD_THRESHOLD;

  if (withinDomainLimit && withinPayloadLimit) {
    return [domains];
  }

  if (domains.length === 1) {
    // 单个域名仍超过阈值时无法继续拆分，只能直接返回
    return [domains];
  }

  const pivot = Math.ceil(domains.length / 2);
  const head = sliceDomains(domains.slice(0, pivot));
  const tail = sliceDomains(domains.slice(pivot));

  return [...head, ...tail];
}

/**
 * 恢复写入失败前的批次数据，避免产生脏数据。
 */
function restoreChunksOnFailure(
  storage: Storage,
  backups: Array<{ key: string; value: string | null }>
): void {
  for (let index = backups.length - 1; index >= 0; index -= 1) {
    const { key, value } = backups[index];

    if (value === null) {
      storage.removeItem(key);
    } else {
      try {
        storage.setItem(key, value);
      } catch {
        // 还原失败时忽略异常，尽可能减少影响
      }
    }
  }
}

/**
 * 从元数据字符串中提取已有批次数量，用于清理无用数据。
 */
function getPersistedChunkCount(rawMetadata: string | null): number {
  if (!rawMetadata) {
    return 0;
  }

  try {
    const metadata = JSON.parse(rawMetadata) as Partial<PersistedInputMetadataV2> | undefined;

    if (metadata && metadata.version === PERSIST_INPUT_VERSION && metadata.chunkCount) {
      return metadata.chunkCount;
    }
  } catch (error) {
    console.warn("Failed to parse persisted input metadata", error);
  }

  return 0;
}

/**
 * 判断是否命中 sessionStorage 空间不足的错误。
 */
function isQuotaExceededError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof DOMException) {
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      // 兼容部分旧版浏览器使用的 code 值
      error.code === 22 ||
      error.code === 1014
    );
  }

  return false;
}

/**
 * 从 sessionStorage 读取最近一次输入。
 */
function loadPersistedInput(): AppState["input"] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const payload = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!payload) {
    return null;
  }

  try {
    const data = JSON.parse(payload) as PersistedInputMetadataV2 |
      (Partial<InputState> & {
        value?: string;
        parsed?: { domains?: Array<{ domain: string; ascii: string; tld?: string }> };
      });

    if (isPersistedMetadataV2(data)) {
      const restoredDomains: DomainItem[] = [];

      for (let index = 0; index < data.chunkCount; index += 1) {
        const chunkPayload = window.sessionStorage.getItem(getChunkStorageKey(index));
        if (!chunkPayload) {
          continue;
        }

        try {
          const chunk = JSON.parse(chunkPayload) as Partial<PersistedInputChunk>;
          if (!Array.isArray(chunk.domains)) {
            continue;
          }

          restoredDomains.push(
            ...chunk.domains
              .map(normalizePersistedDomain)
              .filter((item): item is DomainItem => Boolean(item))
          );
        } catch (error) {
          console.warn("Failed to parse persisted input chunk", error);
        }
      }

      return {
        domains: dedupeDomains(restoredDomains),
        updatedAt: data.updatedAt ?? 0
      } satisfies InputState;
    }

    if (Array.isArray((data as Partial<InputState>).domains)) {
      const legacy = data as Partial<InputState>;

      return {
        domains: legacy.domains!
          .map(normalizePersistedDomain)
          .filter((item): item is DomainItem => Boolean(item)),
        updatedAt: legacy.updatedAt ?? 0
      } satisfies InputState;
    }

    // 兼容旧版存储结构
    if ((data as { parsed?: { domains?: Array<{ domain: string; ascii: string; tld?: string }> } }).parsed?.domains) {
      const legacyParsed = (data as {
        parsed?: { domains?: Array<{ domain: string; ascii: string; tld?: string }> };
        updatedAt?: number;
      }).parsed;

      const fallbackDomains = legacyParsed?.domains
        ?.map((item) =>
          item?.ascii
            ? normalizePersistedDomain({
                ascii: item.ascii,
                display: item.domain ?? item.ascii,
                tld: item.tld
              })
            : null
        )
        .filter((item): item is DomainItem => Boolean(item));

      if (fallbackDomains) {
        return {
          domains: dedupeDomains(fallbackDomains as DomainItem[]),
          updatedAt:
            (data as { updatedAt?: number }).updatedAt ?? 0
        } satisfies InputState;
      }
    }
  } catch (error) {
    console.warn("Failed to parse persisted input", error);
  }

  return null;
}

/**
 * 判断是否属于新版批次持久化的元数据。
 */
function isPersistedMetadataV2(value: unknown): value is PersistedInputMetadataV2 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedInputMetadataV2>;

  return candidate.version === PERSIST_INPUT_VERSION && typeof candidate.chunkCount === "number";
}

/**
 * 基于 reducer 的全局状态管理，负责跨页面共享域名列表及查询结果。
 */
export function AppStateProvider({ children }: PropsWithChildren) {
  const persisted = useMemo(loadPersistedInput, []);
  const persistedSettings = useMemo(loadPersistedSettings, []);

  const reducer = useMemo(() => createReducer(), []);
  const [state, dispatch] = useReducer(reducer, defaultState, (initial) => {
    const nextState: AppState = {
      ...initial,
      settings: persistedSettings ?? { ...defaultSettings }
    };

    if (persisted) {
      nextState.input = persisted;
    }

    return nextState;
  });

  const lastPersistedStamp = useRef<number>(0);
  const lastSettingsRef = useRef<AppSettings>(state.settings);

  useEffect(() => {
    // 根据更新时间判断是否需要写入 sessionStorage
    if (state.input.updatedAt !== lastPersistedStamp.current) {
      persistInput(state.input);
      lastPersistedStamp.current = state.input.updatedAt;
    }
  }, [state.input]);

  useEffect(() => {
    if (!areSettingsEqual(state.settings, lastSettingsRef.current)) {
      persistSettings(state.settings);
      lastSettingsRef.current = state.settings;
    }
  }, [state.settings]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

/**
 * 读取全局 AppState。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAppState(): AppState {
  return useContext(AppStateContext);
}

/**
 * 获取全局 dispatch。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAppDispatch(): Dispatch<AppAction> {
  return useContext(AppDispatchContext);
}

/**
 * 创建 Reducer 函数，将复杂逻辑封装，便于测试。
 */
function createReducer(): (state: AppState, action: AppAction) => AppState {
  return (state, action) => {
    switch (action.type) {
      case "input/setDomains": {
        const normalized = dedupeDomains(action.payload.domains);
        if (areDomainListsEqual(state.input.domains, normalized)) {
          return state;
        }

        return {
          ...state,
          input: {
            domains: normalized,
            updatedAt: Date.now()
          },
          dns: {
            ...state.dns,
            stage: "idle",
            rows: [],
            errorKey: null,
            runId: state.dns.runId + 1,
            completedAt: null,
            totalCount: 0,
            completedCount: 0
          },
          rdap: {
            checkedCount: 0,
            totalCount: 0,
            running: false,
            errorKey: null
          }
        } satisfies AppState;
      }
      case "input/appendDomains": {
        const { domains: merged, added } = mergeDomains(state.input.domains, action.payload.domains);
        if (added === 0) {
          return state;
        }

        return {
          ...state,
          input: {
            domains: merged,
            updatedAt: Date.now()
          },
          dns: {
            ...state.dns,
            stage: "idle",
            rows: [],
            errorKey: null,
            runId: state.dns.runId + 1,
            completedAt: null,
            totalCount: 0,
            completedCount: 0
          },
          rdap: {
            checkedCount: 0,
            totalCount: 0,
            running: false,
            errorKey: null
          }
        } satisfies AppState;
      }
      case "input/appendDomainBatch": {
        const { domains: merged, added } = mergeDomains(state.input.domains, action.payload.domains);
        if (added === 0) {
          return state;
        }

        return {
          ...state,
          input: {
            domains: merged,
            updatedAt: Date.now()
          }
        } satisfies AppState;
      }
      case "input/appendDomainBatchFinalize": {
        return {
          ...state,
          dns: {
            ...state.dns,
            stage: "idle",
            rows: [],
            errorKey: null,
            runId: state.dns.runId + 1,
            completedAt: null,
            totalCount: 0,
            completedCount: 0
          },
          rdap: {
            checkedCount: 0,
            totalCount: 0,
            running: false,
            errorKey: null
          }
        } satisfies AppState;
      }
      case "input/clear": {
        if (state.input.domains.length === 0) {
          return state;
        }

        return {
          ...state,
          input: {
            domains: [],
            updatedAt: Date.now()
          },
          dns: {
            ...defaultState.dns,
            runId: state.dns.runId + 1
          },
          rdap: { ...defaultState.rdap }
        } satisfies AppState;
      }
      case "dns/start": {
        return {
          ...state,
          dns: {
            stage: "dns-checking",
            rows: [],
            errorKey: null,
            runId: action.payload.runId,
            completedAt: null,
            totalCount: action.payload.total,
            completedCount: 0
          },
          rdap: {
            checkedCount: 0,
            totalCount: 0,
            running: false,
            errorKey: null
          }
        } satisfies AppState;
      }
      case "dns/retry": {
        return {
          ...state,
          dns: {
            ...state.dns,
            stage: "dns-checking",
            errorKey: null,
            runId: action.payload.runId,
            completedAt: null,
            totalCount: action.payload.total,
            completedCount: 0
          },
          rdap: {
            checkedCount: 0,
            totalCount: 0,
            running: false,
            errorKey: null
          }
        } satisfies AppState;
      }
      case "dns/progress": {
        if (state.dns.runId !== action.payload.runId) {
          return state;
        }
        return {
          ...state,
          dns: {
            ...state.dns,
            completedCount: Math.min(action.payload.completed, state.dns.totalCount)
          }
        } satisfies AppState;
      }
      case "dns/success": {
        if (state.dns.runId !== action.payload.runId) {
          return state;
        }
        return {
          ...state,
          dns: {
            ...state.dns,
            stage: state.rdap.running ? "rdap-checking" : "done",
            rows: action.payload.rows,
            completedAt: Date.now(),
            completedCount: state.dns.totalCount
          }
        } satisfies AppState;
      }
      case "dns/error": {
        if (state.dns.runId !== action.payload.runId) {
          return state;
        }
        return {
          ...state,
          dns: {
            ...state.dns,
            stage: "error",
            errorKey: action.payload.messageKey
          }
        } satisfies AppState;
      }
      case "rdap/start": {
        return {
          ...state,
          dns: {
            ...state.dns,
            stage: "rdap-checking"
          },
          rdap: {
            ...state.rdap,
            running: true,
            errorKey: null,
            checkedCount: 0,
            totalCount: action.payload.total
          }
        } satisfies AppState;
      }
      case "rdap/update": {
        return {
          ...state,
          dns: {
            ...state.dns,
            rows: action.payload.rows
          },
          rdap: {
            ...state.rdap,
            running: true,
            checkedCount: action.payload.checked
          }
        } satisfies AppState;
      }
      case "rdap/error": {
        return {
          ...state,
          dns: {
            ...state.dns,
            stage: "error"
          },
          rdap: {
            ...state.rdap,
            running: false,
            errorKey: action.payload.messageKey
          }
        } satisfies AppState;
      }
      case "process/complete": {
        return {
          ...state,
          dns: {
            ...state.dns,
            stage: "done",
            rows: action.payload?.rows ?? state.dns.rows
          },
          rdap: {
            ...state.rdap,
            running: false
          }
        } satisfies AppState;
      }
      case "process/reset": {
        return {
          ...state,
          dns: {
            ...defaultState.dns,
            runId: state.dns.runId + 1
          },
          rdap: { ...defaultState.rdap }
        } satisfies AppState;
      }
      case "settings/update": {
        const nextSettings = sanitizeSettings({
          ...state.settings,
          ...action.payload
        });

        if (areSettingsEqual(state.settings, nextSettings)) {
          return state;
        }

        return {
          ...state,
          settings: nextSettings
        } satisfies AppState;
      }
      case "ui/snackbar": {
        return {
          ...state,
          ui: {
            snackbar: action.payload
          }
        } satisfies AppState;
      }
      default:
        return state;
    }
  };
}

/**
 * 将域名条目统一规范化，确保 ASCII 小写与 TLD 存在。
 */
function normalizeDomainItem(item: DomainItem): DomainItem {
  const ascii = item.ascii.trim().toLowerCase();
  const display = item.display?.trim() ? item.display.trim() : ascii;
  const tld = item.tld ?? extractTld(ascii);

  return {
    display,
    ascii,
    ...(tld ? { tld } : {})
  } satisfies DomainItem;
}

/**
 * 根据 ASCII 域名提取顶级域。
 */
function extractTld(ascii: string): string | undefined {
  const lastDot = ascii.lastIndexOf(".");
  if (lastDot === -1 || lastDot === ascii.length - 1) {
    return undefined;
  }
  return ascii.slice(lastDot + 1);
}

/**
 * 对域名数组去重，保留首个出现顺序。
 */
function dedupeDomains(domains: DomainItem[]): DomainItem[] {
  const seen = new Set<string>();
  const result: DomainItem[] = [];

  for (const item of domains) {
    const normalized = normalizeDomainItem(item);
    if (seen.has(normalized.ascii)) {
      continue;
    }
    seen.add(normalized.ascii);
    result.push(normalized);
  }

  return result;
}

/**
 * 合并新增域名，并返回新增数量。
 */
function mergeDomains(
  existing: DomainItem[],
  incoming: DomainItem[]
): { domains: DomainItem[]; added: number } {
  if (incoming.length === 0) {
    return { domains: existing, added: 0 };
  }

  const seen = new Set(existing.map((item) => item.ascii.toLowerCase()));
  const merged = [...existing];
  let added = 0;

  for (const raw of incoming) {
    const normalized = normalizeDomainItem(raw);
    if (seen.has(normalized.ascii)) {
      continue;
    }

    seen.add(normalized.ascii);
    merged.push(normalized);
    added += 1;
  }

  if (added === 0) {
    return { domains: existing, added: 0 };
  }

  return { domains: merged, added };
}

/**
 * 判断两个域名列表是否等价。
 */
function areDomainListsEqual(a: DomainItem[], b: DomainItem[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((item, index) => {
    const target = b[index];
    return (
      item.ascii === target.ascii &&
      item.display === target.display &&
      (item.tld ?? "") === (target.tld ?? "")
    );
  });
}

/**
 * 兼容 sessionStorage 旧数据的域名结构。
 */
function normalizePersistedDomain(input: Partial<DomainItem> | null | undefined): DomainItem | null {
  if (!input?.ascii) {
    return null;
  }

  try {
    return normalizeDomainItem({
      ascii: input.ascii,
      display: input.display ?? input.ascii,
      tld: input.tld
    });
  } catch (error) {
    console.warn("Failed to normalize persisted domain", error, input);
    return null;
  }
}

/**
 * 向 localStorage 写入设置。
 */
function persistSettings(settings: AppSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify(settings);
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, payload);
}

/**
 * 从 localStorage 读取设置。
 */
function loadPersistedSettings(): AppSettings | null {
  if (typeof window === "undefined") {
    return null;
  }

  const payload = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!payload) {
    return null;
  }

  try {
    const data = JSON.parse(payload) as Partial<AppSettings> | null;
    if (!data) {
      return null;
    }

    return sanitizeSettings({
      ...defaultSettings,
      ...data
    });
  } catch (error) {
    console.warn("Failed to parse persisted settings", error);
  }

  return null;
}

/**
 * 规范化设置值，确保字段有效。
 */
function sanitizeSettings(settings: AppSettings): AppSettings {
  const providers = Array.from(new Set(settings.dohProviders)).filter((provider): provider is AppSettings["dohProviders"][number] =>
    provider === "google" || provider === "cloudflare"
  );

  const safeProviders = providers.length > 0 ? providers : [...defaultSettings.dohProviders];
  const rdapConcurrency = Number.isFinite(settings.rdapConcurrency)
    ? Math.min(Math.max(Math.trunc(settings.rdapConcurrency), 1), 12)
    : defaultSettings.rdapConcurrency;
  const dnsConcurrency = Number.isFinite(settings.dnsConcurrency)
    ? Math.min(Math.max(Math.trunc(settings.dnsConcurrency), 200), 5000)
    : defaultSettings.dnsConcurrency;

  return {
    rdapConcurrency,
    dnsConcurrency,
    dohProviders: safeProviders
  } satisfies AppSettings;
}

/**
 * 对比两个设置对象是否等价。
 */
function areSettingsEqual(a: AppSettings, b: AppSettings): boolean {
  return (
    a.rdapConcurrency === b.rdapConcurrency &&
    a.dnsConcurrency === b.dnsConcurrency &&
    a.dohProviders.length === b.dohProviders.length &&
    a.dohProviders.every((provider, index) => provider === b.dohProviders[index])
  );
}
