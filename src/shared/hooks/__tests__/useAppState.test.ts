import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  persistInput,
  PERSIST_INPUT_DOMAIN_THRESHOLD,
  PERSIST_INPUT_PAYLOAD_THRESHOLD
} from "../useAppState";

import { SESSION_STORAGE_KEY, type AppState } from "../../types";

const baseInput: AppState["input"] = {
  domains: [],
  updatedAt: Date.now()
};

describe("persistInput", () => {
  let storageMap: Map<string, string>;

  beforeEach(() => {
    storageMap = new Map();

    const storage = {
      setItem: vi.fn((key: string, value: string) => {
        storageMap.set(key, value);
      }),
      getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        storageMap.delete(key);
      })
    } satisfies Pick<Storage, "setItem" | "getItem" | "removeItem">;

    vi.stubGlobal("window", {
      sessionStorage: storage
    } as unknown as Window & typeof globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("persists payload within threshold", () => {
    const domains = [
      {
        ascii: "example.com",
        display: "example.com"
      }
    ];

    persistInput({ ...baseInput, domains });

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      `${SESSION_STORAGE_KEY}:chunk:0`,
      expect.stringContaining("example.com")
    );
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      SESSION_STORAGE_KEY,
      expect.stringContaining(`"version":2`)
    );
  });

  it("splits payload into multiple chunks when domain count exceeds threshold", () => {
    const domains = Array.from({ length: PERSIST_INPUT_DOMAIN_THRESHOLD + 1 }, (_, index) => ({
      ascii: `example${index}.com`,
      display: `example${index}.com`
    }));

    persistInput({ ...baseInput, domains });

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      `${SESSION_STORAGE_KEY}:chunk:0`,
      expect.any(String)
    );
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      `${SESSION_STORAGE_KEY}:chunk:1`,
      expect.any(String)
    );
    expect(window.sessionStorage.removeItem).not.toHaveBeenCalled();
  });

  it("splits payload when serialized size exceeds threshold", () => {
    const bytesPerDomain = Math.ceil(PERSIST_INPUT_PAYLOAD_THRESHOLD / 10);
    const largeLabel = "x".repeat(bytesPerDomain);
    const domains = Array.from({ length: 12 }, (_, index) => ({
      ascii: `${largeLabel}${index}.com`,
      display: `${largeLabel}${index}.com`
    }));

    persistInput({ ...baseInput, domains });

    const chunkCalls = (window.sessionStorage.setItem as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([key]) => key !== SESSION_STORAGE_KEY
    );

    expect(chunkCalls.length).toBeGreaterThan(1);
  });

  it("handles QuotaExceededError gracefully", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const setItemMock = window.sessionStorage.setItem as unknown as ReturnType<typeof vi.fn>;
    setItemMock
      .mockImplementationOnce(() => {
        throw new DOMException("Quota", "QuotaExceededError");
      })
      .mockImplementation((key: string, value: string) => {
        storageMap.set(key, value);
      });

    expect(() =>
      persistInput({
        ...baseInput,
        domains: [
          {
            ascii: "example.com",
            display: "example.com"
          }
        ]
      })
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
  });

  it("cleans up stale chunk entries when new chunk count is smaller", () => {
    storageMap.set(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        updatedAt: baseInput.updatedAt,
        totalCount: 20,
        chunkCount: 2
      })
    );
    storageMap.set(`${SESSION_STORAGE_KEY}:chunk:0`, JSON.stringify({ domains: [] }));
    storageMap.set(`${SESSION_STORAGE_KEY}:chunk:1`, JSON.stringify({ domains: [] }));

    const domains = [
      {
        ascii: "example.com",
        display: "example.com"
      }
    ];

    persistInput({ ...baseInput, domains });

    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith(
      `${SESSION_STORAGE_KEY}:chunk:1`
    );
  });
});
