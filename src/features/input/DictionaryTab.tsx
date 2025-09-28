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
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppState } from "../../shared/hooks/useAppState";
import { normalizeDomains } from "../../shared/utils/domainParser";
import { createAsciiSet, partitionByExisting, sanitizeTld } from "../../shared/utils/domains";

const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const ALNUM = `${DIGITS}${LETTERS}`;

const PREVIEW_COUNT = 20;
const MIN_LENGTH = 1;
const MAX_LENGTH = 63;

type PatternType = "numeric" | "alnum" | "template";

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

  const existingAscii = useMemo(() => createAsciiSet(input.domains), [input.domains]);

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
    try {
      const sanitizedTld = sanitizeTld(tld);
      const domains = await generateDomains(
        {
          pattern,
          length,
          template,
          tld: sanitizedTld
        },
        PREVIEW_COUNT
      );
      setPreview(domains.slice(0, PREVIEW_COUNT));
    } catch (error) {
      console.error("dictionary preview failed", error);
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: "input.dict.previewFailed" }
      });
    } finally {
      setLoading(false);
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
    try {
      const sanitizedTld = sanitizeTld(tld);
      const domains = await generateDomains({
        pattern,
        length,
        template,
        tld: sanitizedTld
      });

      const { valid, invalid, duplicate } = normalizeDomains(domains);
      const { fresh, duplicate: existingDuplicate } = partitionByExisting(valid, existingAscii);

      if (fresh.length === 0) {
        dispatch({
          type: "ui/snackbar",
          payload: { severity: "info", messageKey: "input.dict.noNew" }
        });
        setSummary({
          generated: domains.length,
          added: 0,
          duplicated: duplicate.length,
          invalid: invalid.length,
          existing: existingDuplicate.length
        });
        return;
      }

      dispatch({ type: "input/appendDomains", payload: { domains: fresh } });
      dispatch({
        type: "ui/snackbar",
        payload: {
          severity: "success",
          messageKey: "input.dict.added",
          messageParams: { count: fresh.length }
        }
      });

      setSummary({
        generated: domains.length,
        added: fresh.length,
        duplicated: duplicate.length,
        invalid: invalid.length,
        existing: existingDuplicate.length
      });
    } catch (error) {
      console.error("dictionary generation failed", error);
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: "input.dict.generateFailed" }
      });
    } finally {
      setLoading(false);
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

  if ((pattern === "numeric" || pattern === "alnum") && sanitizeTld(tld).length === 0) {
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

async function generateDomains(
  { pattern, length, template, tld }: GenerateParams,
  limit?: number
): Promise<string[]> {
  switch (pattern) {
    case "numeric":
      return generateNumeric(length, tld, limit);
    case "alnum":
      return generateAlnum(length, tld, limit);
    case "template":
      return generateFromTemplate(template, tld, limit);
    default:
      return [];
  }
}

async function generateNumeric(length: number, tld: string, limit?: number): Promise<string[]> {
  const maxCombinations = Math.pow(10, length);
  const total = limit === undefined ? maxCombinations : Math.min(limit, maxCombinations);
  const result: string[] = [];
  const batchSize = 2000;

  for (let start = 0; start < total; start += batchSize) {
    const end = Math.min(start + batchSize, total);
    for (let value = start; value < end; value += 1) {
      const label = value.toString().padStart(length, "0");
      result.push(applyTld(label, tld));
    }

    // 分批让出主线程
    if (end < total) {
      await delay();
    }
  }

  return result;
}

async function generateAlnum(length: number, tld: string, limit?: number): Promise<string[]> {
  if (length <= 0) {
    return [];
  }

  const result: string[] = [];
  const counters = new Array(length).fill(0);
  const maxIterations = limit ?? Number.POSITIVE_INFINITY;

  // 逐位枚举所有可能组合，未设置 limit 时输出完整笛卡尔积
  for (let generated = 0; generated < maxIterations; generated += 1) {
    const label = counters.map((index) => ALNUM[index]).join("");
    result.push(applyTld(label, tld));

    let pointer = length - 1;
    while (pointer >= 0) {
      counters[pointer] += 1;
      if (counters[pointer] < ALNUM.length) {
        break;
      }

      counters[pointer] = 0;
      pointer -= 1;
    }

    if (pointer < 0) {
      break;
    }

    if ((generated + 1) % 2000 === 0) {
      await delay();
    }
  }

  return result;
}

async function generateFromTemplate(template: string, tld: string, limit?: number): Promise<string[]> {
  const tokens = parseTemplate(template);
  if (!tokens.valid) {
    throw new Error("invalid-template");
  }

  const placeholders = tokens.placeholders;
  if (placeholders.length === 0) {
    return [applyTld(template, tld)];
  }

  const lengths = placeholders.map((set) => set.length);
  const counters = new Array(placeholders.length).fill(0);
  const result: string[] = [];
  const maxIterations = limit ?? Number.POSITIVE_INFINITY;

  for (let generated = 0; generated < maxIterations; generated += 1) {
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

    result.push(applyTld(parts.join(""), tld));

    if (generated + 1 >= maxIterations) {
      break;
    }

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
      break;
    }

    if ((generated + 1) % 2000 === 0) {
      await delay();
    }
  }

  return result;
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

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
