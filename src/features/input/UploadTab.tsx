import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppState } from "../../shared/hooks/useAppState";
import { normalizeDomains } from "../../shared/utils/domainParser";
import { createAsciiSet, partitionByExisting } from "../../shared/utils/domains";
import {
  detectCsvDelimiter,
  readCsvFile,
  readFileAsLines
} from "../../shared/utils/file";

type SeparatorOption = "auto" | "," | ";" | "\t";

interface UploadState {
  type: "txt" | "csv";
  name: string;
  size: number;
  total: number;
  delimiter?: string;
}

export default function UploadTab() {
  const { t } = useTranslation();
  const { input } = useAppState();
  const dispatch = useAppDispatch();

  const [dragging, setDragging] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [separator, setSeparator] = useState<SeparatorOption>("auto");
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [textEntries, setTextEntries] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [parsing, setParsing] = useState<boolean>(false);
  const [lastAdded, setLastAdded] = useState<number>(0);

  const existingAscii = useMemo(() => createAsciiSet(input.domains), [input.domains]);

  const entries = useMemo(() => {
    // 根据文件类型提取待归一化的原始域名文本
    if (!uploadState) {
      return [] as string[];
    }

    if (uploadState.type === "txt") {
      return textEntries;
    }

    if (csvRows.length === 0) {
      return [] as string[];
    }

    const column = clampColumn(selectedColumn, headers.length);
    const dataRows = csvRows.length > 0 ? csvRows.slice(1) : [];

    return dataRows.map((row) => row[column] ?? "");
  }, [csvRows, headers.length, selectedColumn, textEntries, uploadState]);

  const analysis = useMemo(() => {
    if (entries.length === 0) {
      return { fresh: [], duplicates: [], existing: [], invalid: [] };
    }

    const { valid, duplicate, invalid } = normalizeDomains(entries);
    const { fresh, duplicate: existingDuplicates } = partitionByExisting(valid, existingAscii);

    return {
      fresh,
      duplicates: duplicate,
      existing: existingDuplicates,
      invalid
    };
  }, [entries, existingAscii]);

  const duplicatesCount = analysis.duplicates.length + analysis.existing.length;

  const handleFile = useCallback(
    async (file: File, overrideSeparator?: SeparatorOption) => {
      if (!isSupportedFile(file)) {
        dispatch({
          type: "ui/snackbar",
          payload: { severity: "warning", messageKey: "input.upload.unsupported" }
        });
        return;
      }

      setParsing(true);
      setProgress(0);
      setUploadedFile(file);
      setLastAdded(0);

      try {
        if (file.name.toLowerCase().endsWith(".csv")) {
          // 通过分块解析 CSV，跟踪进度避免页面卡顿
          const currentSeparator = overrideSeparator ?? separator;
          const delimiterOption = currentSeparator === "auto" ? "auto" : currentSeparator;
          const result = await readCsvFile(file, {
            delimiter: delimiterOption,
            onChunk: (_lines, meta) => setProgress(Math.round(meta.progress * 100))
          });

          const resolvedDelimiter = result.delimiter ??
            (delimiterOption === "auto"
              ? detectCsvDelimiter(result.entries.find((line) => line.trim().length > 0) ?? "")
              : delimiterOption);

          const uploadSummary: UploadState = {
            type: "csv",
            name: file.name,
            size: file.size,
            total: result.totalLines,
            delimiter: resolvedDelimiter
          };
          setUploadState(uploadSummary);
          setCsvRows(result.rows ?? []);
          const headerRow = result.headers && result.headers.length > 0 ? result.headers : result.rows?.[0] ?? [];
          setHeaders(headerRow);
          setSelectedColumn(detectDomainColumn(headerRow));
          setTextEntries([]);
        } else {
          const result = await readFileAsLines(file, {
            onChunk: (_lines, meta) => setProgress(Math.round(meta.progress * 100))
          });

          setUploadState({
            type: "txt",
            name: file.name,
            size: file.size,
            total: result.totalLines
          });
          setTextEntries(result.entries);
          setCsvRows([]);
          setHeaders([]);
          setSelectedColumn(0);
        }
      } catch (error) {
        console.error("upload parse failed", error);
        dispatch({
          type: "ui/snackbar",
          payload: { severity: "error", messageKey: "input.upload.parseFailed" }
        });
        setUploadState(null);
        setCsvRows([]);
        setTextEntries([]);
      } finally {
        setParsing(false);
        setProgress(100);
      }
    },
    [dispatch, separator]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer.files?.length) {
        void handleFile(event.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile]
  );

  const handleAdd = useCallback(() => {
    if (analysis.fresh.length === 0) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "info", messageKey: "input.upload.noNew" }
      });
      return;
    }

    dispatch({ type: "input/appendDomains", payload: { domains: analysis.fresh } });
    dispatch({
      type: "ui/snackbar",
      payload: {
        severity: "success",
        messageKey: "input.upload.added",
        messageParams: { count: analysis.fresh.length }
      }
    });
    setLastAdded(analysis.fresh.length);
  }, [analysis.fresh, dispatch]);

  const handleClear = useCallback(() => {
    setUploadState(null);
    setUploadedFile(null);
    setCsvRows([]);
    setHeaders([]);
    setTextEntries([]);
    setProgress(0);
    setLastAdded(0);
  }, []);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {t("input.upload.tip")}
        </Typography>
        <Button variant="text" onClick={() => setHelpOpen(true)}>
          {t("input.upload.help")}
        </Button>
      </Stack>

      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          border: "1px dashed",
          borderColor: dragging ? "primary.main" : "divider",
          borderRadius: 2,
          p: 4,
          textAlign: "center",
          backgroundColor: dragging ? "action.hover" : "transparent"
        }}
      >
        <Typography variant="subtitle1" gutterBottom>
          {t("input.upload.dropHere")}
        </Typography>
        <Button variant="outlined" component="label">
          {t("input.upload.browse")}
          <input type="file" hidden accept=".csv,.txt" onChange={handleFileInput} />
        </Button>
      </Box>

      {parsing ? <LinearProgress variant="determinate" value={progress} /> : null}

      {uploadState ? (
        <Alert severity="info">
          {t("input.upload.fileInfo", {
            name: uploadState.name,
            lines: uploadState.total,
            size: formatBytes(uploadState.size)
          })}
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!uploadState || uploadState.type !== "csv"}>
          <InputLabel>{t("input.upload.separator")}</InputLabel>
          <Select
            label={t("input.upload.separator")}
            value={separator}
            onChange={(event) => {
              const next = event.target.value as SeparatorOption;
              setSeparator(next);
              if (uploadedFile && uploadState?.type === "csv") {
                void handleFile(uploadedFile, next);
              }
            }}
          >
            <MenuItem value="auto">{t("input.upload.separatorAuto")}</MenuItem>
            <MenuItem value=",">{t("input.upload.separatorComma")}</MenuItem>
            <MenuItem value=";">{t("input.upload.separatorSemicolon")}</MenuItem>
            <MenuItem value="\t">{t("input.upload.separatorTab")}</MenuItem>
          </Select>
        </FormControl>

        <FormControl
          size="small"
          sx={{ minWidth: 220 }}
          disabled={!uploadState || uploadState.type !== "csv" || headers.length === 0}
        >
          <InputLabel>{t("input.upload.domainColumn")}</InputLabel>
          <Select
            label={t("input.upload.domainColumn")}
            value={clampColumn(selectedColumn, headers.length)}
            onChange={(event) => setSelectedColumn(Number(event.target.value))}
          >
            {headers.map((header, index) => (
              <MenuItem key={`${header}-${index}`} value={index}>
                {header || t("input.upload.columnFallback", { index: index + 1 })}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Typography variant="body2" color="success.main">
          {t("input.upload.stats.valid", { count: analysis.fresh.length })}
        </Typography>
        <Typography variant="body2" color="warning.main">
          {t("input.upload.stats.duplicate", { count: duplicatesCount })}
        </Typography>
        <Typography variant="body2" color="error.main">
          {t("input.upload.stats.invalid", { count: analysis.invalid.length })}
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button variant="contained" onClick={handleAdd} disabled={analysis.fresh.length === 0}>
          {t("action.add")}
        </Button>
        <Button variant="outlined" onClick={handleClear} disabled={!uploadState}>
          {t("action.clear")}
        </Button>
      </Stack>

      {lastAdded > 0 ? (
        <Alert severity="success">{t("input.upload.lastAdded", { count: lastAdded })}</Alert>
      ) : null}

      {analysis.invalid.length > 0 ? (
        <Alert severity="warning">
          {t("input.upload.invalidHint", { count: analysis.invalid.length })}
        </Alert>
      ) : null}

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("input.upload.helpTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("input.upload.helpContent")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>{t("common.close")}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".txt");
}

function detectDomainColumn(headers: string[]): number {
  if (!headers || headers.length === 0) {
    return 0;
  }

  const target = headers.findIndex((header) => /domain|域名/i.test(header));
  return target >= 0 ? target : 0;
}

function clampColumn(value: number, length: number): number {
  if (length === 0) {
    return 0;
  }
  return Math.min(Math.max(value, 0), length - 1);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(1)} ${units[index]}`;
}
