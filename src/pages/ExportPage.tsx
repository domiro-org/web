import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { TFunction } from "i18next";

import { useWideShellSidebar } from "../layouts/WideShell";
import { useAppDispatch, useAppState } from "../shared/hooks/useAppState";
import type { DomainCheckRow, DohProviderId } from "../shared/types";
import { buildCsvContent, downloadCsv } from "../shared/utils/csv";
import { downloadJson } from "../shared/utils/file";

const DNS_STATUS_KEYS = {
  "has-ns": "dns.status.has-ns",
  "no-ns": "dns.status.no-ns",
  nxdomain: "dns.status.nxdomain",
  error: "dns.status.error"
} as const;

const VERDICT_KEYS = {
  available: "verdict.available",
  taken: "verdict.taken",
  undetermined: "verdict.undetermined",
  "rdap-unsupported": "verdict.rdap-unsupported"
} as const;

//

/**
 * 导出页面：提供结果下载操作。
 */
export default function ExportPage() {
  const { t } = useTranslation();
  const { input, dns, settings } = useAppState();
  const dispatch = useAppDispatch();

  const dnsCsvColumns = useMemo(
    () => [
      {
        key: "domain",
        header: t("dns.table.domain"),
        accessor: (row: DomainCheckRow) => row.domain
      },
      {
        key: "ascii",
        header: t("page.dns.csv.ascii"),
        accessor: (row: DomainCheckRow) => row.ascii
      },
      {
        key: "dns",
        header: t("dns.table.dns"),
        accessor: (row: DomainCheckRow) =>
          t(DNS_STATUS_KEYS[row.dns as keyof typeof DNS_STATUS_KEYS])
      },
      {
        key: "verdict",
        header: t("dns.table.verdict"),
        accessor: (row: DomainCheckRow) =>
          t(VERDICT_KEYS[row.verdict as keyof typeof VERDICT_KEYS])
      },
      {
        key: "detail",
        header: t("dns.table.detail"),
        accessor: (row: DomainCheckRow) => row.detail ?? ""
      }
    ],
    [t]
  );

  const hasDnsRows = dns.rows.length > 0;
  const hasRdapRows = dns.rows.some((row) => row.rdap !== null);

  const handleDownloadDnsCsv = useCallback(() => {
    if (!hasDnsRows) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "warning", messageKey: "page.export.snackbar.noDns" }
      });
      return;
    }

    const content = buildCsvContent(dns.rows, dnsCsvColumns);
    const filename = `dns-results-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, content);
    dispatch({
      type: "ui/snackbar",
      payload: { severity: "success", messageKey: "page.export.snackbar.dnsCsv" }
    });
  }, [dispatch, dns.rows, dnsCsvColumns, hasDnsRows]);

  const handleDownloadDnsJson = useCallback(() => {
    if (!hasDnsRows) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "warning", messageKey: "page.export.snackbar.noDns" }
      });
      return;
    }

    const filename = `dns-results-${new Date().toISOString()}.json`;
    downloadJson(filename, dns.rows);
    dispatch({
      type: "ui/snackbar",
      payload: { severity: "success", messageKey: "page.export.snackbar.dnsJson" }
    });
  }, [dispatch, dns.rows, hasDnsRows]);

  const handleDownloadRdapJson = useCallback(() => {
    if (!hasRdapRows) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "warning", messageKey: "page.export.snackbar.noRdap" }
      });
      return;
    }

    const filename = `rdap-results-${new Date().toISOString()}.json`;
    const payload = dns.rows.filter((row) => row.rdap !== null);
    downloadJson(filename, payload);
    dispatch({
      type: "ui/snackbar",
      payload: { severity: "success", messageKey: "page.export.snackbar.rdapJson" }
    });
  }, [dispatch, dns.rows, hasRdapRows]);

  const handleDownloadState = useCallback(() => {
    const filename = `domiro-session-${new Date().toISOString()}.json`;
    const snapshot = {
      input,
      dns,
      settings
    };
    downloadJson(filename, snapshot);
    dispatch({
      type: "ui/snackbar",
      payload: { severity: "success", messageKey: "page.export.snackbar.state" }
    });
  }, [dispatch, dns, input, settings]);


  const providerLabel = useMemo(
    () => formatProviders(settings.dohProviders, t),
    [settings.dohProviders, t]
  );
  const lastSavedLabel = useMemo(
    () => (input.updatedAt ? formatTime(input.updatedAt) : "-"),
    [input.updatedAt]
  );

  const sidebarContent = useMemo(
    () => (
      <Stack spacing={3} sx={{ flexGrow: 1 }}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("page.export.sidebar.title")}
          </Typography>
          <Stack spacing={1}>
            <SidebarStat label={t("page.export.sidebar.savedAt")} value={lastSavedLabel} />
            <SidebarStat label={t("page.export.sidebar.totalDns")} value={dns.rows.length} />
            <SidebarStat label={t("page.export.sidebar.providers")} value={providerLabel} />
            <SidebarStat
              label={t("page.export.sidebar.proxy")}
              value={
                settings.useProxy
                  ? t("page.export.sidebar.enabled")
                  : t("page.export.sidebar.disabled")
              }
            />
          </Stack>
        </Paper>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("page.export.sidebar.hintTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("page.export.sidebar.hintBody")}
          </Typography>
        </Paper>
      </Stack>
    ),
    [dns.rows.length, lastSavedLabel, providerLabel, settings.useProxy, t]
  );

  useWideShellSidebar(sidebarContent);

  return (
    <>
      <Paper elevation={1} sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Typography variant="h4">{t("page.export.title")}</Typography>
          <Typography variant="body1" color="text.secondary">
            {t("page.export.description")}
          </Typography>
        </Stack>
      </Paper>

      <Paper
        elevation={1}
        sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}
      >
        <Typography variant="h6">{t("page.export.actions.title")}</Typography>
        {!hasDnsRows ? <Alert severity="info">{t("page.export.actions.empty")}</Alert> : null}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap>
          <Button variant="contained" onClick={handleDownloadDnsCsv} disabled={!hasDnsRows}>
            {t("page.export.actions.dnsCsv")}
          </Button>
          <Button variant="outlined" onClick={handleDownloadDnsJson} disabled={!hasDnsRows}>
            {t("page.export.actions.dnsJson")}
          </Button>
          <Button variant="outlined" onClick={handleDownloadRdapJson} disabled={!hasRdapRows}>
            {t("page.export.actions.rdapJson")}
          </Button>
          <Button variant="text" onClick={handleDownloadState}>
            {t("page.export.actions.stateJson")}
          </Button>
        </Stack>
      </Paper>

      {/* 设置区块已迁移至独立的设置页 */}
    </>
  );
}

interface SidebarStatProps {
  label: string;
  value: string | number;
}

function SidebarStat({ label, value }: SidebarStatProps) {
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
 * 将提供者列表格式化为展示文本。
 */
function formatProviders(providers: DohProviderId[], t: TFunction): string {
  const labels = providers.map((provider) => t(`page.export.settings.provider.${provider}`));
  return labels.length > 0 ? labels.join(" / ") : "-";
}

/**
 * 将时间戳格式化为可读字符串。
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
