import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppState } from "../../shared/hooks/useAppState";
import { normalizeDomains } from "../../shared/utils/domainParser";
import { createAsciiSet, partitionByExisting, sanitizeTld } from "../../shared/utils/domains";
import type { DomainItem } from "../../shared/types";

const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const ALNUM = `${DIGITS}${LETTERS}`;
const LETTER_CHARSET = LETTERS.split("");
const ALNUM_CHARSET = ALNUM.split("");

const PREVIEW_COUNT = 20;
const MIN_LENGTH = 1;
const MAX_LENGTH = 63;

type PatternType = "numeric" | "alpha" | "alnum" | "template";

interface GenerationSummary {
  generated: number;
  added: number;
  duplicated: number;
  invalid: number;
  existing: number;
}

export default function DictionaryTab() {
  const { t } = useTranslation();
  const { input } = useAppState();
  const dispatch = useAppDispatch();

  const [pattern, setPattern] = useState<PatternType>("numeric");
  const [length, setLength] = useState<number>(6);
  const [tld, setTld] = useState<string>("");
  const [template, setTemplate] = useState<string>("{n}{n}{n}{n}{n}{n}");
  const [preview, setPreview] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);

  // 通过 runIdRef 标记最新任务，防止旧任务回调继续更新状态
  const runIdRef = useRef(0);
  // 记录当前预览/生成的 AbortController，便于随时取消长任务
  const previewAbortRef = useRef<AbortController | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const existingAscii = useMemo(() => createAsciiSet(input.domains), [input.domains]);

  const handlePatternChange = useCallback((value: PatternType) => {
    runIdRef.current += 1;
    previewAbortRef.current?.abort();
    generateAbortRef.current?.abort();
    setPattern(value);
    setPreview([]);
    setSummary(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 组件卸载时立即终止仍在运行的生成任务，避免内存泄露
    return () => {
      mountedRef.current = false;
      previewAbortRef.current?.abort();
      generateAbortRef.current?.abort();
    };
  }, []);

  const handlePreview = useCallback(async () => {
    const validated = validateInputs(pattern, length, tld, template);
    if (!validated.valid) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: validated.errorKey }
      });
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;

    setSummary(null);
    setPreview([]);
    setLoading(true);
    try {
      const sanitizedTld = sanitizeTld(tld);
      const generator = generateDomains(
        {
          pattern,
          length,
          template,
          tld: sanitizedTld
        },
        {
          limit: PREVIEW_COUNT,
          signal: controller.signal
        }
      );

      const collected: string[] = [];
      for await (const batch of generator) {
        if (controller.signal.aborted || runIdRef.current !== runId || !mountedRef.current) {
          break;
        }
        collected.push(...batch);
        if (collected.length >= PREVIEW_COUNT) {
          break;
        }
      }

      if (!controller.signal.aborted && runIdRef.current === runId && mountedRef.current) {
        setPreview(collected.slice(0, PREVIEW_COUNT));
      }
    } catch (error) {
      if (controller.signal.aborted || runIdRef.current !== runId || !mountedRef.current) {
        return;
      }
      console.error("dictionary preview failed", error);
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: "input.dict.previewFailed" }
      });
    } finally {
      if (runIdRef.current === runId && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [dispatch, length, pattern, tld, template]);

  const handleGenerate = useCallback(async () => {
    const validated = validateInputs(pattern, length, tld, template);
    if (!validated.valid) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: validated.errorKey }
      });
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    generateAbortRef.current?.abort();
    const controller = new AbortController();
    generateAbortRef.current = controller;

    setLoading(true);
    setSummary(null);
    try {
      const sanitizedTld = sanitizeTld(tld);
      const generator = generateDomains(
        {
          pattern,
          length,
          template,
          tld: sanitizedTld
        },
        { signal: controller.signal }
      );

      const aggregated: GenerationSummary = {
        generated: 0,
        added: 0,
        duplicated: 0,
        invalid: 0,
        existing: 0
      };
      const existingTracker = new Set(existingAscii);
      const generatedAscii = new Set<string>();

      for await (const batch of generator) {
        if (controller.signal.aborted || runIdRef.current !== runId || !mountedRef.current) {
          break;
        }
        aggregated.generated += batch.length;
        if (batch.length === 0) {
          continue;
        }

        const { valid, invalid, duplicate } = normalizeDomains(batch);
        aggregated.invalid += invalid.length;
        aggregated.duplicated += duplicate.length;

        const uniqueValid: DomainItem[] = [];
        for (const domain of valid) {
          if (generatedAscii.has(domain.ascii)) {
            aggregated.duplicated += 1;
            continue;
          }

          generatedAscii.add(domain.ascii);
          uniqueValid.push(domain);
        }

        if (uniqueValid.length === 0) {
          if (!controller.signal.aborted && runIdRef.current === runId && mountedRef.current) {
            setSummary({ ...aggregated });
          }
          continue;
        }

        const { fresh, duplicate: existingDuplicate } = partitionByExisting(uniqueValid, existingTracker);
        aggregated.existing += existingDuplicate.length;

        if (fresh.length > 0) {
          for (const item of fresh) {
            existingTracker.add(item.ascii);
          }

          aggregated.added += fresh.length;
          if (!controller.signal.aborted && runIdRef.current === runId && mountedRef.current) {
            dispatch({ type: "input/appendDomainBatch", payload: { domains: fresh } });
          }
        }

        if (!controller.signal.aborted && runIdRef.current === runId && mountedRef.current) {
          setSummary({ ...aggregated });
        }
      }

      if (controller.signal.aborted || runIdRef.current !== runId || !mountedRef.current) {
        return;
      }

      setSummary({ ...aggregated });

      if (aggregated.added === 0) {
        dispatch({
          type: "ui/snackbar",
          payload: { severity: "info", messageKey: "input.dict.noNew" }
        });
        return;
      }

      dispatch({
        type: "ui/snackbar",
        payload: {
          severity: "success",
          messageKey: "input.dict.added",
          messageParams: { count: aggregated.added }
        }
      });
    } catch (error) {
      if (controller.signal.aborted || runIdRef.current !== runId || !mountedRef.current) {
        return;
      }
      console.error("dictionary generation failed", error);
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: "input.dict.generateFailed" }
      });
    } finally {
      if (runIdRef.current === runId && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [dispatch, existingAscii, length, pattern, tld, template]);

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        {t("input.dict.desc")}
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <FormControl fullWidth size="small">
          <InputLabel>{t("input.dict.patternType")}</InputLabel>
          <Select
            label={t("input.dict.patternType")}
            value={pattern}
            onChange={(event) => handlePatternChange(event.target.value as PatternType)}
          >
            <MenuItem value="numeric">{t("input.dict.numericN")}</MenuItem>
            <MenuItem value="alpha">{t("input.dict.alphaN")}</MenuItem>
            <MenuItem value="alnum">{t("input.dict.alnumN")}</MenuItem>
            <MenuItem value="template">{t("input.dict.template")}</MenuItem>
          </Select>
        </FormControl>

        <TextField
          type="number"
          label={t("input.dict.length")}
          value={length}
          onChange={(event) => setLength(Number(event.target.value))}
          inputProps={{ min: MIN_LENGTH, max: MAX_LENGTH }}
          size="small"
        />

        <TextField
          label={t("input.dict.tld")}
          value={tld}
          onChange={(event) => setTld(event.target.value)}
          placeholder=".xyz"
          size="small"
        />

      </Stack>

      {pattern === "template" ? (
        <TextField
          label={t("input.dict.templateLabel")}
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          helperText={t("input.dict.templateHint")}
          size="small"
          fullWidth
        />
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button variant="outlined" onClick={handlePreview} disabled={loading}>
          {t("action.preview")}
        </Button>
        <Button variant="contained" onClick={handleGenerate} disabled={loading}>
          {t("action.generateAdd")}
        </Button>
      </Stack>

      {loading ? <LinearProgress /> : null}

      {summary ? (
        <Alert severity={summary.added > 0 ? "success" : "info"}>
          {t("input.dict.summary", {
            generated: summary.generated,
            added: summary.added,
            duplicate: summary.duplicated + summary.existing,
            invalid: summary.invalid
          })}
        </Alert>
      ) : null}

      {preview.length > 0 ? (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t("input.dict.previewTitle", { count: Math.min(PREVIEW_COUNT, preview.length) })}
          </Typography>
          <List dense disablePadding>
            {preview.map((item) => (
              <ListItem key={item} divider>
                <ListItemText primary={item} />
              </ListItem>
            ))}
          </List>
        </Box>
      ) : null}
    </Stack>
  );
}

interface GenerateParams {
  pattern: PatternType;
  length: number;
  template: string;
  tld: string;
}

interface GenerateOptions {
  limit?: number;
  signal?: AbortSignal;
}

type ValidationResult = { valid: true } | { valid: false; errorKey: string };

function validateInputs(
  pattern: PatternType,
  length: number,
  tld: string,
  template: string
): ValidationResult {
  if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    return { valid: false, errorKey: "input.dict.invalidLength" };
  }

  if (pattern !== "template" && sanitizeTld(tld).length === 0) {
    return { valid: false, errorKey: "input.dict.invalidTld" };
  }

  if (pattern === "template" && template.trim().length === 0) {
    return { valid: false, errorKey: "input.dict.invalidTemplate" };
  }

  const sanitizedTld = sanitizeTld(tld);
  if (sanitizedTld && !/^([a-z0-9-]{2,63})$/.test(sanitizedTld)) {
    return { valid: false, errorKey: "input.dict.invalidTld" };
  }

  return { valid: true };
}

/**
 * 根据用户选择的模式生成域名，支持批量迭代与外部取消。
 * @param params 生成配置（模式、长度、模板、TLD）
 * @param options 生成限制与取消信号
 */
async function* generateDomains(
  { pattern, length, template, tld }: GenerateParams,
  options: GenerateOptions = {}
): AsyncGenerator<string[]> {
  const { limit, signal } = options;
  switch (pattern) {
    case "numeric":
      yield* generateNumeric(length, tld, limit, signal);
      return;
    case "alpha":
      yield* generateAlpha(length, tld, limit, signal);
      return;
    case "alnum":
      yield* generateAlnum(length, tld, limit, signal);
      return;
    case "template":
      yield* generateFromTemplate(template, tld, limit, signal);
      return;
    default:
      return;
  }
}

/**
 * 生成固定长度的纯数字域名。
 * @param length 数字串长度
 * @param tld 顶级域
 * @param limit 可选的最大生成数量
 * @param signal 取消信号
 */
async function* generateNumeric(
  length: number,
  tld: string,
  limit?: number,
  signal?: AbortSignal
): AsyncGenerator<string[]> {
  if (length <= 0 || signal?.aborted) {
    return;
  }

  const maxCombinations = Math.pow(10, length);
  const total = limit === undefined ? maxCombinations : Math.min(limit, maxCombinations);
  const batchSize = 2000;

  for (let start = 0; start < total; start += batchSize) {
    if (signal?.aborted) {
      return;
    }
    const end = Math.min(start + batchSize, total);
    const batch: string[] = [];
    for (let value = start; value < end; value += 1) {
      if (signal?.aborted) {
        return;
      }
      const label = value.toString().padStart(length, "0");
      batch.push(applyTld(label, tld));
    }

    if (signal?.aborted) {
      return;
    }

    if (batch.length > 0) {
      yield batch;
    }

    // 分批让出主线程
    if (end < total) {
      await delay(signal);
    }
  }
}

/**
 * 基于字母字符集生成域名。
 * @param length 域名长度
 * @param tld 顶级域
 * @param limit 可选的最大生成数量
 * @param signal 取消信号
 */
async function* generateAlpha(
  length: number,
  tld: string,
  limit?: number,
  signal?: AbortSignal
): AsyncGenerator<string[]> {
  yield* generateByCharset(LETTER_CHARSET, length, tld, limit, signal);
}

/**
 * 基于字母与数字混合字符集生成域名。
 * @param length 域名长度
 * @param tld 顶级域
 * @param limit 可选的最大生成数量
 * @param signal 取消信号
 */
async function* generateAlnum(
  length: number,
  tld: string,
  limit?: number,
  signal?: AbortSignal
): AsyncGenerator<string[]> {
  yield* generateByCharset(ALNUM_CHARSET, length, tld, limit, signal);
}

/**
 * 通过计数器枚举指定字符集的所有组合。
 * @param charset 可用字符集合
 * @param length 域名长度
 * @param tld 顶级域
 * @param limit 可选的最大生成数量
 * @param signal 取消信号
 */
async function* generateByCharset(
  charset: string[],
  length: number,
  tld: string,
  limit?: number,
  signal?: AbortSignal
): AsyncGenerator<string[]> {
  if (length <= 0 || signal?.aborted) {
    return;
  }

  const counters = new Array(length).fill(0);
  const maxIterations = limit ?? Number.POSITIVE_INFINITY;
  const batchSize = 2000;
  let generated = 0;
  let exhausted = false;

  // 使用计数器逐位枚举给定字符集的笛卡尔积，保证生成顺序稳定
  while (!exhausted && generated < maxIterations) {
    if (signal?.aborted) {
      return;
    }
    const batch: string[] = [];

    while (batch.length < batchSize && generated < maxIterations && !exhausted) {
      if (signal?.aborted) {
        return;
      }
      const label = counters.map((index) => charset[index]).join("");
      batch.push(applyTld(label, tld));
      generated += 1;

      let pointer = length - 1;
      while (pointer >= 0) {
        counters[pointer] += 1;
        if (counters[pointer] < charset.length) {
          break;
        }

        counters[pointer] = 0;
        pointer -= 1;
      }

      if (pointer < 0) {
        exhausted = true;
      }
    }

    if (signal?.aborted) {
      return;
    }

    if (batch.length > 0) {
      yield batch;
    }

    if (!exhausted && generated < maxIterations) {
      await delay(signal);
    }
  }
}

/**
 * 基于模板占位符逐批生成域名。
 * @param template 模板字符串
 * @param tld 顶级域
 * @param limit 可选的最大生成数量
 * @param signal 取消信号
 */
async function* generateFromTemplate(
  template: string,
  tld: string,
  limit?: number,
  signal?: AbortSignal
): AsyncGenerator<string[]> {
  if (signal?.aborted) {
    return;
  }
  const tokens = parseTemplate(template);
  if (!tokens.valid) {
    throw new Error("invalid-template");
  }

  const placeholders = tokens.placeholders;
  if (placeholders.length === 0) {
    if (signal?.aborted) {
      return;
    }
    yield [applyTld(template, tld)];
    return;
  }

  const lengths = placeholders.map((set) => set.length);
  const counters = new Array(placeholders.length).fill(0);
  const maxIterations = limit ?? Number.POSITIVE_INFINITY;
  const batchSize = 2000;
  let generated = 0;
  let exhausted = false;

  while (!exhausted && generated < maxIterations) {
    if (signal?.aborted) {
      return;
    }
    const batch: string[] = [];

    while (batch.length < batchSize && generated < maxIterations && !exhausted) {
      if (signal?.aborted) {
        return;
      }
      const parts: string[] = [];
      let placeholderIndex = 0;

      for (const token of tokens.tokens) {
        if (token.type === "literal") {
          parts.push(token.value);
          continue;
        }

        parts.push(placeholders[placeholderIndex][counters[placeholderIndex]]);
        placeholderIndex += 1;
      }

      batch.push(applyTld(parts.join(""), tld));
      generated += 1;

      let pointer = counters.length - 1;
      while (pointer >= 0) {
        counters[pointer] += 1;
        if (counters[pointer] < lengths[pointer]) {
          break;
        }

        counters[pointer] = 0;
        pointer -= 1;
      }

      if (pointer < 0) {
        exhausted = true;
      }
    }

    if (signal?.aborted) {
      return;
    }

    if (batch.length > 0) {
      yield batch;
    }

    if (!exhausted && generated < maxIterations) {
      await delay(signal);
    }
  }
}

function applyTld(label: string, tld: string): string {
  if (!tld) {
    return label;
  }

  const suffix = tld.startsWith(".") ? tld.slice(1) : tld;
  if (!suffix) {
    return label;
  }

  const lowerSuffix = suffix.toLowerCase();
  if (label.toLowerCase().endsWith(`.${lowerSuffix}`)) {
    return label;
  }

  return `${label}.${lowerSuffix}`;
}

function parseTemplate(template: string): {
  valid: boolean;
  tokens: Array<{ type: "literal"; value: string } | { type: "placeholder"; value: string }>;
  placeholders: string[][];
} {
  const tokens: Array<{ type: "literal"; value: string } | { type: "placeholder"; value: string }> = [];
  const placeholders: string[][] = [];
  let buffer = "";

  for (let index = 0; index < template.length; index += 1) {
    const char = template[index];
    if (char !== "{") {
      buffer += char;
      continue;
    }

    const closeIndex = template.indexOf("}", index);
    if (closeIndex === -1) {
      return { valid: false, tokens: [], placeholders: [] };
    }

    if (buffer) {
      tokens.push({ type: "literal", value: buffer });
      buffer = "";
    }

    const placeholder = template.slice(index + 1, closeIndex).trim().toLowerCase();
    const charset = resolveCharset(placeholder);
    if (!charset) {
      return { valid: false, tokens: [], placeholders: [] };
    }

    tokens.push({ type: "placeholder", value: placeholder });
    placeholders.push(charset);
    index = closeIndex;
  }

  if (buffer) {
    tokens.push({ type: "literal", value: buffer });
  }

  return { valid: true, tokens, placeholders };
}

function resolveCharset(token: string): string[] | null {
  switch (token) {
    case "n":
      return DIGITS.split("");
    case "a":
      return LETTERS.split("");
    case "al":
      return ALNUM.split("");
    default:
      return null;
  }
}

/**
 * 让出事件循环，避免阻塞主线程，支持取消。
 * @param signal 取消信号
 */
function delay(signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const handleAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", handleAbort);
      resolve();
    };

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, 0);

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}
