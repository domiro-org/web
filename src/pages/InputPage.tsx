import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import DictionaryTab from "../features/input/DictionaryTab";
import ManualTab from "../features/input/ManualTab";
import UploadTab from "../features/input/UploadTab";
import { useWideShellSidebar } from "../layouts/WideShellContext";
import { useAppDispatch, useAppState } from "../shared/hooks/useAppState";

type TabValue = "dictionary" | "upload" | "manual";

const TAB_ITEMS: Array<{ value: TabValue; labelKey: string }> = [
  { value: "dictionary", labelKey: "tab.dictionary" },
  { value: "upload", labelKey: "tab.upload" },
  { value: "manual", labelKey: "tab.manual" }
];

export default function InputPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { input } = useAppState();
  const [tab, setTab] = useState<TabValue>("dictionary");

  const domainCount = input.domains.length;

  const sidebarContent = useMemo(
    () => (
      <Stack spacing={3} sx={{ flexGrow: 1 }}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("input.sidebar.title")}
          </Typography>
          <Stack spacing={1}>
            <StatItem label={t("input.sidebar.total")}
              value={domainCount}
            />
            <StatItem
              label={t("input.sidebar.lastUpdated")}
              value={input.updatedAt ? formatTime(input.updatedAt) : t("input.sidebar.never")}
            />
          </Stack>
        </Paper>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("input.sidebar.hintTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("input.sidebar.hintBody")}
          </Typography>
        </Paper>
      </Stack>
    ),
    [domainCount, input.updatedAt, t]
  );

  useWideShellSidebar(sidebarContent);

  const handleTabChange = useCallback((_event: React.SyntheticEvent, value: TabValue) => {
    setTab(value);
  }, []);

  const handleClearAll = useCallback(() => {
    if (domainCount === 0) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "info", messageKey: "input.clear.empty" }
      });
      return;
    }

    dispatch({ type: "input/clear" });
    dispatch({
      type: "ui/snackbar",
      payload: { severity: "success", messageKey: "input.clear.success" }
    });
  }, [dispatch, domainCount]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ xs: "flex-start", md: "center" }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" gutterBottom>
              {t("input.title")}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t("input.description")}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t("input.currentCount", { count: domainCount })}
            </Typography>
            <Button variant="outlined" onClick={handleClearAll}>
              {t("action.clearAll")}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {TAB_ITEMS.map((item) => (
            <Tab key={item.value} value={item.value} label={t(item.labelKey)} />
          ))}
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {tab === "dictionary" ? <DictionaryTab /> : null}
          {tab === "upload" ? <UploadTab /> : null}
          {tab === "manual" ? <ManualTab /> : null}
        </Box>
      </Paper>
    </Stack>
  );
}

interface StatItemProps {
  label: string;
  value: number | string;
}

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

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
