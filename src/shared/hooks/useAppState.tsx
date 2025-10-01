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
  dohProviders: ["google", "cloudflare"],
  useProxy: false,
  enableWhoisFallback: false
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
 * 将输入状态持久化到 sessionStorage，避免刷新丢失。
 */
function persistInput(value: AppState["input"]): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify({
    domains: value.domains,
    updatedAt: value.updatedAt
  });

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, payload);
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
    const data = JSON.parse(payload) as Partial<InputState> & {
      value?: string;
      parsed?: { domains?: Array<{ domain: string; ascii: string; tld?: string }> };
    };

    if (Array.isArray(data.domains)) {
      return {
        domains: data.domains.map(normalizePersistedDomain).filter(Boolean) as DomainItem[],
        updatedAt: data.updatedAt ?? 0
      } satisfies InputState;
    }

    // 兼容旧版存储结构
    if (data.parsed?.domains) {
      const fallbackDomains = data.parsed.domains
        .map((item) =>
          item?.ascii
            ? normalizePersistedDomain({
                ascii: item.ascii,
                display: item.domain ?? item.ascii,
                tld: item.tld
              })
            : null
        )
        .filter((item): item is DomainItem => Boolean(item));

      return {
        domains: dedupeDomains(fallbackDomains as DomainItem[]),
        updatedAt: data.updatedAt ?? 0
      } satisfies InputState;
    }
  } catch (error) {
    console.warn("Failed to parse persisted input", error);
  }

  return null;
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
    dohProviders: safeProviders,
    useProxy: Boolean(settings.useProxy),
    enableWhoisFallback: Boolean(settings.enableWhoisFallback)
  } satisfies AppSettings;
}

/**
 * 对比两个设置对象是否等价。
 */
function areSettingsEqual(a: AppSettings, b: AppSettings): boolean {
  return (
    a.rdapConcurrency === b.rdapConcurrency &&
    a.dnsConcurrency === b.dnsConcurrency &&
    a.useProxy === b.useProxy &&
    a.enableWhoisFallback === b.enableWhoisFallback &&
    a.dohProviders.length === b.dohProviders.length &&
    a.dohProviders.every((provider, index) => provider === b.dohProviders[index])
  );
}
