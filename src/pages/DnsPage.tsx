import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { alpha } from "@mui/material/styles";

import { StatsCard, HintCard } from "../components/SidebarCards";
import { useWideShellSidebar } from "../layouts/WideShell";
import { useAppDispatch, useAppState } from "../shared/hooks/useAppState";
import type { DomainCheckRow } from "../shared/types";
import { buildCsvContent, downloadCsv } from "../shared/utils/csv";
import { runDohQuery } from "../shared/utils/dohQuery";
import {
  deriveDnsVerdict,
  mergeDetails,
  shouldRunRdap
} from "../shared/utils/checkPipeline";
import { dnsStatusToChipProps, verdictToChipProps } from "../shared/utils/status";

/**
 * DNS 预筛页面。
 */
export default function DnsPage() {
  const { t } = useTranslation();
  const { input, dns, settings } = useAppState();
  const dispatch = useAppDispatch();

  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: "domain",
        headerName: t("dns.table.domain"),
        flex: 1.5,
        minWidth: 200,
        renderCell: (params) => (
          <Stack spacing={0.5}>
            <Typography variant="body2">{params.row.domain}</Typography>
            {params.row.ascii !== params.row.domain ? (
              <Typography variant="caption" color="text.secondary">
                {params.row.ascii}
              </Typography>
            ) : null}
          </Stack>
        )
      },
      {
        field: "dns",
        headerName: t("dns.table.dns"),
        flex: 1,
        minWidth: 160,
        renderCell: (params) => {
          const chipMeta = dnsStatusToChipProps(params.row.dns);
          return (
            <Chip
              label={t(chipMeta.labelKey)}
              color={chipMeta.color}
              variant={chipMeta.variant}
              size="small"
            />
          );
        }
      },
      {
        field: "verdict",
        headerName: t("dns.table.verdict"),
        flex: 1,
        minWidth: 160,
        renderCell: (params) => {
          const chipMeta = verdictToChipProps(params.row.verdict);
          return (
            <Chip
              label={t(chipMeta.labelKey)}
              color={chipMeta.color}
              variant={chipMeta.variant}
              size="small"
            />
          );
        }
      },
      {
        field: "detail",
        headerName: t("dns.table.detail"),
        flex: 2,
        sortable: false,
        minWidth: 240,
        renderCell: (params) => (
          <Typography variant="body2" color="text.secondary">
            {params.row.detail ?? t("dns.table.detail-empty")}
          </Typography>
        )
      }
    ],
    [t]
  );

  const csvColumns = useMemo(
    () => [
      {
        key: "domain",
        header: t("dns.table.domain"),
        accessor: (row: DomainCheckRow) => row.domain
      },
      {
        key: "ascii",
        header: t("dns.csv.ascii"),
        accessor: (row: DomainCheckRow) => row.ascii
      },
      {
        key: "dns",
        header: t("dns.table.dns"),
        accessor: (row: DomainCheckRow) => t(dnsStatusToChipProps(row.dns).labelKey)
      },
      {
        key: "verdict",
        header: t("dns.table.verdict"),
        accessor: (row: DomainCheckRow) => t(verdictToChipProps(row.verdict).labelKey)
      },
      {
        key: "detail",
        header: t("dns.table.detail"),
        accessor: (row: DomainCheckRow) => row.detail ?? ""
      }
    ],
    [t]
  );

  const stats = useMemo(() => buildDnsStats(dns.rows), [dns.rows]);

  const sidebarContent = useMemo(
    () => (
      <Stack spacing={3} sx={{ flexGrow: 1 }}>
        <StatsCard
          titleKey="dns.stats.title"
          stats={[
            { label: t("dns.stats.total"), value: stats.total },
            { label: t("dns.stats.hasNs"), value: stats.hasNs },
            { label: t("dns.stats.noNs"), value: stats.noNs },
            { label: t("dns.stats.nxdomain"), value: stats.nxdomain },
            { label: t("dns.stats.error"), value: stats.error }
          ]}
        />
        <HintCard i18nKey="hint.dns" />
      </Stack>
    ),
    [stats.error, stats.hasNs, stats.noNs, stats.nxdomain, stats.total, t]
  );

  useWideShellSidebar(sidebarContent);

  const handleExport = useCallback(() => {
    if (dns.rows.length === 0) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "warning", messageKey: "page.dns.snackbar.noResult" }
      });
      return;
    }

    const content = buildCsvContent(dns.rows, csvColumns);
    const fileName = `dns-results-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(fileName, content);
    dispatch({
      type: "ui/snackbar",
      payload: { severity: "success", messageKey: "page.dns.snackbar.exported" }
    });
  }, [csvColumns, dispatch, dns.rows]);

  const handleRunChecks = useCallback(async () => {
    if (input.parsed.domains.length === 0) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "warning", messageKey: "page.dns.snackbar.noInput" }
      });
      return;
    }

    const runId = Date.now();
    dispatch({ type: "dns/start", payload: { runId } });

    // 预生成表格基础行，便于后续填充查询结果
    const baseRows = input.parsed.domains.map((domain) => ({
      id: domain.id,
      domain: domain.domain,
      ascii: domain.ascii,
      tld: domain.tld,
      dns: "error" as const,
      rdap: null,
      verdict: "undetermined" as const,
      detail: undefined
    }));

    try {
      // 使用 Promise.all 并行执行 DoH 查询，加快批量处理速度
      const nextRows = await Promise.all(
        baseRows.map(async (row) => {
          try {
            const result = await runDohQuery(row.ascii, settings.dohProviders);
            const providerLabel = result.provider
              ? t(`dns.provider.${result.provider}`)
              : t("dns.provider.unknown");
            const detailText = mergeDetails(
              result.detail ? t(result.detail) : undefined,
              t("dns.detail.source", { provider: providerLabel })
            );

            const dnsStatus = result.status;
            return {
              ...row,
              dns: dnsStatus,
              verdict: deriveDnsVerdict(dnsStatus),
              detail: detailText
            };
          } catch (error) {
            console.error("runDohQuery error", error);
            return {
              ...row,
              dns: "error" as const,
              verdict: "undetermined" as const,
              detail: t("dns.detail.network-error")
            };
          }
        })
      );

      dispatch({ type: "dns/success", payload: { rows: nextRows, runId } });

      const requiresRdap = nextRows.some((row) => shouldRunRdap(row.dns));
      if (!requiresRdap) {
        dispatch({ type: "process/complete", payload: { rows: nextRows } });
      }

      dispatch({
        type: "ui/snackbar",
        payload: { severity: "success", messageKey: "page.dns.snackbar.success" }
      });
    } catch (error) {
      console.error("DNS precheck failed", error);
      dispatch({ type: "dns/error", payload: { messageKey: "dns.error.general", runId } });
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: "dns.error.general" }
      });
    }
  }, [dispatch, input.parsed.domains, settings.dohProviders, t]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={3}
          alignItems={{ md: "flex-start" }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" gutterBottom>
              {t("dns.title")}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t("dns.subtitle.line1")}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t("dns.subtitle.line2")}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="flex-end"
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            <Button
              onClick={handleRunChecks}
              disabled={dns.stage === "dns-checking"}
            >
              {t("dns.run")}
            </Button>
            <Button
              variant="outlined"
              onClick={handleExport}
              disabled={dns.rows.length === 0}
            >
              {t("dns.exportCsv")}
            </Button>
            <Button
              variant="text"
              onClick={() => dispatch({ type: "process/reset" })}
            >
              {t("dns.clear")}
            </Button>
          </Stack>
        </Stack>
        {dns.stage === "error" && dns.errorKey ? (
          <Alert severity="error" sx={{ mt: 3 }}>
            {t(dns.errorKey)}
          </Alert>
        ) : null}
      </Paper>

      {dns.stage === "dns-checking" ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {t("common.progress.overall")}
            </Typography>
            <LinearProgress />
          </Stack>
        </Paper>
      ) : null}

      <Paper
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0
        }}
      >
        <Box sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle1">
            {t("dns.table.title")}
          </Typography>
        </Box>
        <Box
          // 仅在表格区域滚动，保持顶部工具区稳定
          sx={{ height: "calc(100vh - 220px)", overflow: "auto" }}
        >
          <DataGrid
            rows={dns.rows}
            columns={columns}
            pagination
            density="compact"
            rowHeight={36}
            columnHeaderHeight={44}
            disableRowSelectionOnClick
            disableVirtualization={dns.rows.length <= 200}
            loading={dns.stage === "dns-checking"}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } }
            }}
            pageSizeOptions={[25, 50, 100]}
            aria-label={t("dns.table.aria")}
            localeText={{
              noRowsLabel: t("dns.table.empty"),
              footerTotalRows: t("dns.table.total", { count: dns.rows.length })
            }}
            sx={{
              border: 0,
              "& .MuiDataGrid-columnHeaders": {
                position: "sticky",
                top: 0,
                zIndex: 1,
                backgroundColor: (theme) =>
                  alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.92 : 0.85),
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                boxShadow: "none"
              },
              "& .MuiDataGrid-cell": {
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`
              },
              "& .MuiDataGrid-virtualScroller": {
                overflowY: "auto"
              },
              "& .MuiDataGrid-overlayWrapper": {
                alignItems: "center"
              },
              "& .MuiDataGrid-overlayWrapperInner": {
                justifyContent: "center"
              },
              "& .MuiCircularProgress-root": {
                width: 18,
                height: 18
              }
            }}
          />
        </Box>
      </Paper>
    </Stack>
  );
}

interface DnsStats {
  total: number;
  hasNs: number;
  noNs: number;
  nxdomain: number;
  error: number;
}

function buildDnsStats(rows: DomainCheckRow[]): DnsStats {
  return rows.reduce<DnsStats>(
    (acc, row) => {
      acc.total += 1;
      switch (row.dns) {
        case "has-ns":
          acc.hasNs += 1;
          break;
        case "no-ns":
          acc.noNs += 1;
          break;
        case "nxdomain":
          acc.nxdomain += 1;
          break;
        default:
          acc.error += 1;
      }
      return acc;
    },
    { total: 0, hasNs: 0, noNs: 0, nxdomain: 0, error: 0 }
  );
}
