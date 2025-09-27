import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useWideShellSidebar } from "../layouts/WideShell";
import { useAppDispatch, useAppState } from "../shared/hooks/useAppState";
import { useDebouncedValue } from "../shared/hooks/useDebouncedValue";
import { parseDomains } from "../shared/utils/domainParser";

/**
 * 输入页：负责录入与校验域名列表。
 */
export default function InputPage() {
  const { t } = useTranslation();
  const { input } = useAppState();
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState(input.value);

  const debouncedInput = useDebouncedValue(draft, 200);
  const previewResult = useMemo(() => parseDomains(debouncedInput), [debouncedInput]);

  const handleSave = useCallback(() => {
    const result = parseDomains(draft);
    dispatch({ type: "input/set", payload: { value: draft, parsed: result } });
    dispatch({
      type: "ui/snackbar",
      payload: {
        severity: "success",
        messageKey: "page.input.snackbar.saved"
      }
    });
  }, [dispatch, draft]);

  const handleReset = useCallback(() => {
    setDraft("");
  }, []);

  const hasDomains = previewResult.domains.length > 0;
  const totalEntries = previewResult.domains.length + previewResult.errors.length;

  const sidebarContent = useMemo(
    () => (
      <Stack spacing={3} sx={{ flexGrow: 1 }}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("page.input.sidebar.title")}
          </Typography>
          <Stack spacing={1}>
            <StatItem label={t("page.input.sidebar.total")} value={totalEntries} />
            <StatItem label={t("page.input.sidebar.valid")} value={previewResult.domains.length} />
            <StatItem label={t("page.input.sidebar.invalid")} value={previewResult.errors.length} />
            <StatItem
              label={t("page.input.sidebar.lastSaved")}
              value={input.updatedAt ? formatTime(input.updatedAt) : "-"}
            />
          </Stack>
        </Paper>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("page.input.sidebar.hintTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("page.input.sidebar.hintBody")}
          </Typography>
        </Paper>
      </Stack>
    ),
    [input.updatedAt, previewResult.domains.length, previewResult.errors.length, t, totalEntries]
  );

  useWideShellSidebar(sidebarContent);

  return (
    <>
      <Paper
        elevation={1}
        sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            {t("page.input.title")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t("page.input.description")}
          </Typography>
        </Box>

        <TextField
          multiline
          fullWidth
          minRows={10}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("page.input.placeholder") ?? ""}
          helperText={t("page.input.helper")}
          label={t("page.input.label")}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!hasDomains}
          >
            {t("page.input.action.save")}
          </Button>
          <Button variant="outlined" onClick={handleReset}>
            {t("page.input.action.reset")}
          </Button>
        </Stack>
      </Paper>

      <Paper
        elevation={1}
        sx={{
          p: 3,
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minHeight: 0
        }}
      >
        <Typography variant="h6">
          {t("page.input.preview.title")}
        </Typography>
        {!hasDomains && previewResult.errors.length === 0 ? (
          <Alert severity="info">{t("page.input.preview.empty")}</Alert>
        ) : null}

        {hasDomains && (
          <Alert severity="success">
            {t("page.input.preview.valid", {
              count: previewResult.domains.length
            })}
          </Alert>
        )}

        {previewResult.errors.length > 0 && (
          <Alert severity="warning">
            {t("page.input.preview.invalid", {
              count: previewResult.errors.length
            })}
          </Alert>
        )}

        <Box
          sx={{
            flexGrow: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2
          }}
        >
          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              overflow: "auto"
            }}
          >
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t("page.input.preview.validList")}
              </Typography>
              {hasDomains ? (
                <List dense disablePadding>
                  {previewResult.domains.map((domain) => (
                    <ListItem key={domain.id} divider>
                      <ListItemText
                        primary={domain.domain}
                        secondary={
                          domain.ascii !== domain.domain ? domain.ascii : undefined
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t("page.input.preview.validEmpty")}
                </Typography>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              overflow: "auto"
            }}
          >
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t("page.input.preview.errorList")}
              </Typography>
              {previewResult.errors.length > 0 ? (
                <List dense disablePadding>
                  {previewResult.errors.map((error, index) => (
                    <ListItem key={`${error.input}-${error.code}-${index}`} divider>
                      <ListItemText
                        primary={error.input}
                        secondary={t(`parse.errors.${error.code}`)}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t("page.input.preview.errorEmpty")}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </>
  );
}

interface StatItemProps {
  label: string;
  value: number | string;
}

/**
 * 侧栏统计展示。
 */
function StatItem({ label, value }: StatItemProps) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}

/**
 * 将时间戳格式化为可读时间。
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
