import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  persistInput,
  PERSIST_INPUT_DOMAIN_THRESHOLD,
  PERSIST_INPUT_PAYLOAD_THRESHOLD
} from "../useAppState";

import type { AppState } from "../types";

const baseInput: AppState["input"] = {
  domains: [],
  updatedAt: Date.now()
};

describe("persistInput", () => {
  beforeEach(() => {
    const storage = {
      setItem: vi.fn(),
      getItem: vi.fn()
    } satisfies Pick<Storage, "setItem" | "getItem">;

    vi.stubGlobal(
      "window",
      {
        sessionStorage: storage
      } as unknown as Window & typeof globalThis
    );
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

    expect(window.sessionStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("skips persisting when domain count exceeds threshold", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const domains = Array.from({ length: PERSIST_INPUT_DOMAIN_THRESHOLD + 1 }, (_, index) => ({
      ascii: `example${index}.com`,
      display: `example${index}.com`
    }));

    persistInput({ ...baseInput, domains });

    expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("skips persisting when payload size exceeds threshold", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const bytesPerDomain = Math.ceil(
      PERSIST_INPUT_PAYLOAD_THRESHOLD / 10
    );
    const largeLabel = "x".repeat(bytesPerDomain);
    const domains = Array.from({ length: 12 }, (_, index) => ({
      ascii: `${largeLabel}${index}.com`,
      display: `${largeLabel}${index}.com`
    }));

    persistInput({ ...baseInput, domains });

    expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("handles QuotaExceededError gracefully", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    (window.sessionStorage.setItem as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        throw new DOMException("Quota", "QuotaExceededError");
      }
    );

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

  it("accepts extremely large domain lists by skipping persistence", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const domains = Array.from({ length: 100_000 }, (_, index) => ({
      ascii: `bulk${index}.com`,
      display: `bulk${index}.com`
    }));

    expect(() => persistInput({ ...baseInput, domains })).not.toThrow();
    expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
