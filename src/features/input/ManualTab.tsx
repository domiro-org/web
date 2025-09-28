import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppState } from "../../shared/hooks/useAppState";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import type { DomainItem } from "../../shared/types";
import { normalizeDomains } from "../../shared/utils/domainParser";
import { createAsciiSet, partitionByExisting } from "../../shared/utils/domains";

interface ManualAnalysis {
  fresh: DomainItem[];
  batchDuplicates: string[];
  existingDuplicates: DomainItem[];
  invalid: string[];
}

export default function ManualTab() {
  const { t } = useTranslation();
  const { input } = useAppState();
  const dispatch = useAppDispatch();

  const [text, setText] = useState<string>("");
  const [lastAdded, setLastAdded] = useState<number>(0);

  const debounced = useDebouncedValue(text, 300);

  const existingAscii = useMemo(() => createAsciiSet(input.domains), [input.domains]);

  const analysis = useMemo<ManualAnalysis>(() => {
    // 借助归一化工具计算有效、重复与无效的数量
    const lines = debounced.length > 0 ? debounced.split(/\r?\n/g) : [];
    if (lines.length === 0) {
      return { fresh: [], batchDuplicates: [], existingDuplicates: [], invalid: [] };
    }

    const { valid, duplicate, invalid } = normalizeDomains(lines);
    const { fresh, duplicate: existingDuplicates } = partitionByExisting(valid, existingAscii);

    return {
      fresh,
      batchDuplicates: duplicate,
      existingDuplicates,
      invalid
    } satisfies ManualAnalysis;
  }, [debounced, existingAscii]);

  const duplicatesCount = analysis.batchDuplicates.length + analysis.existingDuplicates.length;

  const handleAdd = useCallback(() => {
    if (analysis.fresh.length === 0) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "info", messageKey: "input.manual.noNew" }
      });
      return;
    }

    dispatch({ type: "input/appendDomains", payload: { domains: analysis.fresh } });
    dispatch({
      type: "ui/snackbar",
      payload: {
        severity: "success",
        messageKey: "input.manual.added",
        messageParams: { count: analysis.fresh.length }
      }
    });
    setLastAdded(analysis.fresh.length);
  }, [analysis.fresh, dispatch]);

  const handleClear = useCallback(() => {
    setText("");
    setLastAdded(0);
  }, []);

  const totalLines = text.length > 0 ? text.split(/\r?\n/g).filter((line) => line.trim().length > 0).length : 0;

  return (
    <Stack spacing={2}>
      <TextField
        multiline
        minRows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t("input.manual.placeholder") ?? ""}
        helperText={t("input.manual.helper")}
        label={t("input.manual.label")}
        size="small"
        fullWidth
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {t("input.manual.stats.total", { count: totalLines })}
        </Typography>
        <Typography variant="body2" color="success.main">
          {t("input.manual.stats.valid", { count: analysis.fresh.length })}
        </Typography>
        <Typography variant="body2" color="warning.main">
          {t("input.manual.stats.duplicate", { count: duplicatesCount })}
        </Typography>
        <Typography variant="body2" color="error.main">
          {t("input.manual.stats.invalid", { count: analysis.invalid.length })}
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button variant="contained" onClick={handleAdd} disabled={analysis.fresh.length === 0}>
          {t("action.add")}
        </Button>
        <Button variant="outlined" onClick={handleClear} disabled={text.length === 0}>
          {t("action.clear")}
        </Button>
      </Stack>

      {lastAdded > 0 ? (
        <Alert severity="success">{t("input.manual.lastAdded", { count: lastAdded })}</Alert>
      ) : null}

      {analysis.invalid.length > 0 ? (
        <Alert severity="warning">
          {t("input.manual.invalidHint", { count: analysis.invalid.length })}
        </Alert>
      ) : null}
    </Stack>
  );
}
