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
  type DomainParseResult,
  SESSION_STORAGE_KEY,
  SETTINGS_STORAGE_KEY
} from "../types";

const EMPTY_PARSE_RESULT: DomainParseResult = { domains: [], errors: [] };

const defaultSettings: AppSettings = {
  rdapConcurrency: 3,
  dohProviders: ["google", "cloudflare"],
  useProxy: false,
  enableWhoisFallback: false
};

const defaultState: AppState = {
  settings: { ...defaultSettings },
  input: {
    value: "",
    parsed: EMPTY_PARSE_RESULT,
    updatedAt: 0
  },
  dns: {
    stage: "idle",
    rows: [],
    errorKey: null,
    runId: 0,
    completedAt: null
  },
  rdap: {
    checkedCount: 0,
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
    value: value.value,
    parsed: value.parsed,
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
    const data = JSON.parse(payload) as AppState["input"];
    if (
      typeof data.value === "string" &&
      data.parsed &&
      Array.isArray(data.parsed.domains) &&
      Array.isArray(data.parsed.errors)
    ) {
      return {
        value: data.value,
        parsed: data.parsed,
        updatedAt: data.updatedAt ?? 0
      } satisfies AppState["input"];
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
export function useAppState(): AppState {
  return useContext(AppStateContext);
}

/**
 * 获取全局 dispatch。
 */
export function useAppDispatch(): Dispatch<AppAction> {
  return useContext(AppDispatchContext);
}

/**
 * 创建 Reducer 函数，将复杂逻辑封装，便于测试。
 */
function createReducer(): (state: AppState, action: AppAction) => AppState {
  return (state, action) => {
    switch (action.type) {
      case "input/set": {
        return {
          ...state,
          input: {
            value: action.payload.value,
            parsed: action.payload.parsed,
            updatedAt: Date.now()
          },
          dns: {
            ...state.dns,
            stage: "idle",
            rows: [],
            errorKey: null,
            runId: state.dns.runId + 1,
            completedAt: null
          },
          rdap: {
            checkedCount: 0,
            running: false,
            errorKey: null
          }
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
            completedAt: null
          },
          rdap: {
            checkedCount: 0,
            running: false,
            errorKey: null
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
            rows: action.payload.rows,
            completedAt: Date.now()
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
            errorKey: null
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
  const concurrency = Number.isFinite(settings.rdapConcurrency)
    ? Math.min(Math.max(Math.trunc(settings.rdapConcurrency), 1), 12)
    : defaultSettings.rdapConcurrency;

  return {
    rdapConcurrency: concurrency,
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
    a.useProxy === b.useProxy &&
    a.enableWhoisFallback === b.enableWhoisFallback &&
    a.dohProviders.length === b.dohProviders.length &&
    a.dohProviders.every((provider, index) => provider === b.dohProviders[index])
  );
}
