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

const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const ALNUM = `${DIGITS}${LETTERS}`;
const LETTER_CHARSET = LETTERS.split("");
const ALNUM_CHARSET = ALNUM.split("");

const PREVIEW_COUNT = 20;
const GENERATION_BATCH_SIZE = 2000;
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
  const [progress, setProgress] = useState<{ total: number | null; generated: number } | null>(
    null
  );

  const abortRef = useRef<AbortController | null>(null);

  const existingAscii = useMemo(() => createAsciiSet(input.domains), [input.domains]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handlePatternChange = useCallback((value: PatternType) => {
    setPattern(value);
    setPreview([]);
    setSummary(null);
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

    setLoading(true);
    setSummary(null);
    setProgress(null);
    try {
      const sanitizedTld = sanitizeTld(tld);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const generator = generateDomains(
        {
          pattern,
          length,
          template,
          tld: sanitizedTld
        },
        { limit: PREVIEW_COUNT, batchSize: PREVIEW_COUNT, signal: controller.signal }
      );

      const domains: string[] = [];
      for await (const batch of generator) {
        domains.push(...batch);
        if (domains.length >= PREVIEW_COUNT) {
          break;
        }
      }

      setPreview(domains.slice(0, PREVIEW_COUNT));
    } catch (error) {
      console.error("dictionary preview failed", error);
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: "input.dict.previewFailed" }
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
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

    setLoading(true);
    setSummary(null);
    try {
      const sanitizedTld = sanitizeTld(tld);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const totalEstimate = estimateTotalCount({ pattern, length, template });
      setProgress({ total: totalEstimate, generated: 0 });

      const asciiSet = new Set(existingAscii);
      const generator = generateDomains(
        {
          pattern,
          length,
          template,
          tld: sanitizedTld
        },
        { batchSize: GENERATION_BATCH_SIZE, signal: controller.signal }
      );

      let generatedCount = 0;
      let addedCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;
      let existingCount = 0;
      let hasFresh = false;

      for await (const batch of generator) {
        generatedCount += batch.length;

        const { valid, invalid, duplicate } = normalizeDomains(batch);
        const { fresh, duplicate: existingDuplicate } = partitionByExisting(valid, asciiSet);

        for (const item of fresh) {
          asciiSet.add(item.ascii);
        }

        invalidCount += invalid.length;
        duplicateCount += duplicate.length;
        existingCount += existingDuplicate.length;
        addedCount += fresh.length;

        if (fresh.length > 0) {
          hasFresh = true;
          dispatch({ type: "input/appendDomainBatch", payload: { domains: fresh } });
        }

        setSummary({
          generated: generatedCount,
          added: addedCount,
          duplicated: duplicateCount,
          invalid: invalidCount,
          existing: existingCount
        });

        setProgress((current) =>
          current ? { total: current.total, generated: generatedCount } : current
        );
      }

      if (addedCount > 0) {
        dispatch({ type: "input/appendDomainBatchFinalize" });
      }

      if (!hasFresh) {
        dispatch({
          type: "ui/snackbar",
          payload: { severity: "info", messageKey: "input.dict.noNew" }
        });
        setSummary({
          generated: generatedCount,
          added: 0,
          duplicated: duplicateCount,
          invalid: invalidCount,
          existing: existingCount
        });
        return;
      }

      dispatch({
        type: "ui/snackbar",
        payload: {
          severity: "success",
          messageKey: "input.dict.added",
          messageParams: { count: addedCount }
        }
      });

      setSummary({
        generated: generatedCount,
        added: addedCount,
        duplicated: duplicateCount,
        invalid: invalidCount,
        existing: existingCount
      });
    } catch (error) {
      console.error("dictionary generation failed", error);
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: "input.dict.generateFailed" }
      });
    } finally {
      setLoading(false);
      setProgress(null);
      abortRef.current = null;
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

        {pattern !== "template" ? (
          <TextField
            type="number"
            label={t("input.dict.length")}
            value={length}
            onChange={(event) => setLength(Number(event.target.value))}
            inputProps={{ min: MIN_LENGTH, max: MAX_LENGTH }}
            size="small"
          />
        ) : null}

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

      {progress ? (
        <Box>
          <LinearProgress
            variant={progress.total !== null ? "determinate" : "indeterminate"}
            value={
              progress.total !== null
                ? Math.min((progress.generated / progress.total) * 100, 100)
                : undefined
            }
          />
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            {progress.total !== null
              ? t("input.dict.progressWithTotal", {
                  generated: progress.generated,
                  total: progress.total
                })
              : t("input.dict.progress", { generated: progress.generated })}
          </Typography>
        </Box>
      ) : null}

      {loading && !progress ? <LinearProgress /> : null}

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
  batchSize?: number;
  signal?: AbortSignal;
}

type ValidationResult = { valid: true } | { valid: false; errorKey: string };

function validateInputs(
  pattern: PatternType,
  length: number,
  tld: string,
  template: string
): ValidationResult {
  if (
    pattern !== "template" &&
    (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH)
  ) {
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

async function* generateDomains(
  { pattern, length, template, tld }: GenerateParams,
  options: GenerateOptions = {}
): AsyncGenerator<string[], void, void> {
  switch (pattern) {
    case "numeric":
      yield* generateNumeric(length, tld, options);
      break;
    case "alpha":
      yield* generateByCharset(LETTER_CHARSET, length, tld, options);
      break;
    case "alnum":
      yield* generateByCharset(ALNUM_CHARSET, length, tld, options);
      break;
    case "template":
      yield* generateFromTemplate(template, tld, options);
      break;
    default:
      return;
  }
}

/**
 * 逐批生成纯数字域名序列。
 */
async function* generateNumeric(
  length: number,
  tld: string,
  { limit, batchSize = GENERATION_BATCH_SIZE, signal }: GenerateOptions
): AsyncGenerator<string[], void, void> {
  const maxCombinations = Math.pow(10, length);
  const total = limit === undefined ? maxCombinations : Math.min(limit, maxCombinations);
  let produced = 0;
  let batch: string[] = [];

  while (produced < total) {
    if (signal?.aborted) {
      return;
    }

    const label = produced.toString().padStart(length, "0");
    batch.push(applyTld(label, tld));
    produced += 1;

    const shouldFlush = batch.length >= batchSize || produced >= total;
    if (shouldFlush) {
      yield batch;
      batch = [];
      if (produced < total) {
        await delay(signal);
      }
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * 逐批生成指定字符集的笛卡尔积组合。
 */
async function* generateByCharset(
  charset: string[],
  length: number,
  tld: string,
  { limit, batchSize = GENERATION_BATCH_SIZE, signal }: GenerateOptions
): AsyncGenerator<string[], void, void> {
  if (length <= 0) {
    return;
  }

  const maxCombinations = Math.pow(charset.length, length);
  const maxIterations = limit === undefined ? maxCombinations : Math.min(limit, maxCombinations);
  const counters = new Array(length).fill(0);
  let generated = 0;
  let finished = false;
  let batch: string[] = [];

  while (!finished && generated < maxIterations) {
    if (signal?.aborted) {
      return;
    }

    const label = counters.map((index) => charset[index]).join("");
    batch.push(applyTld(label, tld));
    generated += 1;

    if (generated >= maxIterations) {
      finished = true;
    } else {
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
        finished = true;
      }
    }

    if (batch.length >= batchSize || finished) {
      yield batch;
      batch = [];
      if (!finished) {
        await delay(signal);
      }
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * 逐批生成模板占位符组合。
 */
async function* generateFromTemplate(
  template: string,
  tld: string,
  { limit, batchSize = GENERATION_BATCH_SIZE, signal }: GenerateOptions
): AsyncGenerator<string[], void, void> {
  const tokens = parseTemplate(template);
  if (!tokens.valid) {
    throw new Error("invalid-template");
  }

  const placeholders = tokens.placeholders;
  if (placeholders.length === 0) {
    yield [applyTld(template, tld)];
    return;
  }

  const lengths = placeholders.map((set) => set.length);
  const counters = new Array(placeholders.length).fill(0);
  const maxCombinations = lengths.reduce((acc, current) => acc * current, 1);
  const maxIterations = limit === undefined ? maxCombinations : Math.min(limit, maxCombinations);
  let generated = 0;
  let finished = false;
  let batch: string[] = [];

  while (!finished && generated < maxIterations) {
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

    if (generated >= maxIterations) {
      finished = true;
    } else {
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
        finished = true;
      }
    }

    if (batch.length >= batchSize || finished) {
      yield batch;
      batch = [];
      if (!finished) {
        await delay(signal);
      }
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * 估算当前配置下的总组合数，用于进度显示。
 */
function estimateTotalCount({
  pattern,
  length,
  template
}: Omit<GenerateParams, "tld">): number | null {
  switch (pattern) {
    case "numeric":
      return clampCombinationCount(Math.pow(10, length));
    case "alpha":
      return clampCombinationCount(Math.pow(LETTER_CHARSET.length, length));
    case "alnum":
      return clampCombinationCount(Math.pow(ALNUM_CHARSET.length, length));
    case "template": {
      const parsed = parseTemplate(template);
      if (!parsed.valid) {
        return null;
      }

      if (parsed.placeholders.length === 0) {
        return 1;
      }

      let total = 1;
      for (const set of parsed.placeholders) {
        total = total * set.length;
        if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) {
          return null;
        }
      }
      return Math.floor(total);
    }
    default:
      return null;
  }
}

/**
 * 对组合总数进行安全裁剪，避免溢出。
 */
function clampCombinationCount(value: number): number | null {
  if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER) {
    return null;
  }
  return Math.floor(value);
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
 * 异步等待一个事件循环，用于让出主线程。
 */
function delay(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 0);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    }
  });
}
