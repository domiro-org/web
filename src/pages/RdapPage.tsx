import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useWideShellSidebar } from "../layouts/WideShell";
import { useAppDispatch, useAppState } from "../shared/hooks/useAppState";
import { useConcurrentQueue } from "../shared/hooks/useConcurrentQueue";
import type { DomainCheckRow } from "../shared/types";
import { runRdapQuery } from "../shared/utils/rdapQuery";
import {
  deriveVerdictWithRdap,
  mergeDetails,
  shouldRunRdap
} from "../shared/utils/checkPipeline";

const RDAP_STAGE_COLORS: Record<number, "success" | "warning" | "error" | "info"> = {
  200: "error",
  404: "success",
  429: "warning",
  400: "info",
  405: "info",
  501: "info"
};

/**
 * RDAP 校验页面。
 */
export default function RdapPage() {
  const { t } = useTranslation();
  const { dns, rdap, settings } = useAppState();
  const dispatch = useAppDispatch();
  const { enqueue, clear } = useConcurrentQueue(settings.rdapConcurrency);

  useEffect(() => clear, [clear]);

  const rows = dns.rows;
  const rdapCandidates = useMemo(
    () => rows.filter((row) => shouldRunRdap(row.dns)),
    [rows]
  );

  const progressValue = useMemo(() => {
    if (rdapCandidates.length === 0) {
      return 0;
    }
    return Math.round((rdap.checkedCount / rdapCandidates.length) * 100);
  }, [rdapCandidates.length, rdap.checkedCount]);

  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: "domain",
        headerName: t("dns.table.domain"),
        flex: 1.3,
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
        minWidth: 150,
        renderCell: (params) => (
          <Chip
            label={t(`dns.status.${params.row.dns}`)}
            color={mapDnsChipColor(params.row.dns)}
            size="small"
          />
        )
      },
      {
        field: "rdap",
        headerName: t("page.rdap.table.rdap"),
        flex: 1,
        minWidth: 140,
        renderCell: (params) => (
          <Chip
            label={params.row.rdap === null
              ? t("page.rdap.table.pending")
              : t("page.rdap.table.status", { status: params.row.rdap })}
            color={mapRdapChipColor(params.row.rdap)}
            size="small"
          />
        )
      },
      {
        field: "verdict",
        headerName: t("dns.table.verdict"),
        flex: 1,
        minWidth: 160,
        renderCell: (params) => (
          <Chip
            label={t(`verdict.${params.row.verdict}`)}
            color={mapVerdictChipColor(params.row.verdict)}
            size="small"
            variant="outlined"
          />
        )
      },
      {
        field: "detail",
        headerName: t("dns.table.detail"),
        flex: 2,
        sortable: false,
        minWidth: 260,
        renderCell: (params) => (
          <Typography variant="body2" color="text.secondary">
            {params.row.detail ?? t("dns.table.detail-empty")}
          </Typography>
        )
      }
    ],
    [t]
  );

  const stats = useMemo(() => buildRdapStats(rdapCandidates, rdap.checkedCount), [
    rdapCandidates,
    rdap.checkedCount
  ]);

  const sidebarContent = useMemo(
    () => (
      <Stack spacing={3} sx={{ flexGrow: 1 }}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("page.rdap.sidebar.title")}
          </Typography>
          <Stack spacing={1.5}>
            <SidebarStat label={t("page.rdap.sidebar.total")} value={stats.total} />
            <SidebarStat label={t("page.rdap.sidebar.checked")} value={stats.checked} />
            <SidebarStat label={t("page.rdap.sidebar.pending")} value={stats.pending} />
            <SidebarStat label={t("page.rdap.sidebar.available")} value={stats.available} />
            <SidebarStat label={t("page.rdap.sidebar.taken")} value={stats.taken} />
            <SidebarStat label={t("page.rdap.sidebar.rateLimited")} value={stats.rateLimited} />
          </Stack>
        </Paper>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("page.rdap.sidebar.hintTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("page.rdap.sidebar.hintBody")}
          </Typography>
        </Paper>
      </Stack>
    ),
    [
      stats.available,
      stats.checked,
      stats.pending,
      stats.rateLimited,
      stats.taken,
      stats.total,
      t
    ]
  );

  useWideShellSidebar(sidebarContent);

  const handleRunRdap = useCallback(async () => {
    if (rows.length === 0) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "warning", messageKey: "page.rdap.snackbar.noDns" }
      });
      return;
    }

    if (rdapCandidates.length === 0) {
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "info", messageKey: "page.rdap.snackbar.noTarget" }
      });
      return;
    }

    // 发起 RDAP 流程，切换全局状态为运行中
    dispatch({ type: "rdap/start" });

    const sourceLabel = t("rdap.source.rdap-org");
    const sourceDetail = t("rdap.detail.source", { source: sourceLabel });
    const rowOrder = rows.map((row) => row.id);
    const workingMap = new Map(rows.map((row) => [row.id, row]));
    let completed = 0;

    // 单个任务完成后刷新 Map 并广播最新结果
    const updateSnapshot = (updatedRow: DomainCheckRow) => {
      workingMap.set(updatedRow.id, updatedRow);
      completed += 1;
      const snapshot = rowOrder.map((id) => workingMap.get(id)!);
      dispatch({
        type: "rdap/update",
        payload: { rows: snapshot, checked: completed }
      });
    };

    try {
      // 控制并发执行 RDAP 请求，全部完成后再落盘
      await Promise.all(
        rdapCandidates.map((candidate) =>
          enqueue(async () => {
            try {
              const rdapResult = await runRdapQuery(candidate.ascii, {
                useProxy: settings.useProxy
              });
              if (rdapResult.unsupported && settings.enableWhoisFallback) {
                // TODO: integrate WHOIS fallback for unsupported TLDs
              }
              const nextDetail = mergeDetails(
                mergeDetails(candidate.detail, sourceDetail),
                t(rdapResult.detailKey, rdapResult.detailParams)
              );
              const nextRow: DomainCheckRow = {
                ...candidate,
                rdap: rdapResult.status,
                verdict: deriveVerdictWithRdap(candidate.dns, rdapResult),
                detail: nextDetail
              };
              updateSnapshot(nextRow);
            } catch (error) {
              console.error("runRdapQuery error", error);
              const nextRow: DomainCheckRow = {
                ...candidate,
                rdap: candidate.rdap,
                verdict: deriveVerdictWithRdap(candidate.dns, null),
                detail: mergeDetails(candidate.detail, t("rdap.detail.network-error"))
              };
              updateSnapshot(nextRow);
            }
          })
        )
      );

      const finalRows = rowOrder.map((id) => workingMap.get(id)!);
      dispatch({ type: "process/complete", payload: { rows: finalRows } });
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "success", messageKey: "page.rdap.snackbar.success" }
      });
    } catch (error) {
      console.error("RDAP execution failed", error);
      dispatch({ type: "rdap/error", payload: { messageKey: "rdap.error.general" } });
      dispatch({
        type: "ui/snackbar",
        payload: { severity: "error", messageKey: "rdap.error.general" }
      });
    }
  }, [
    rows,
    rdapCandidates,
    dispatch,
    enqueue,
    settings.enableWhoisFallback,
    settings.useProxy,
    t
  ]);

  return (
    <>
      <Paper
        elevation={1}
        sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            {t("page.rdap.title")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t("page.rdap.description")}
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap>
          <Button
            variant="contained"
            onClick={handleRunRdap}
            disabled={rdap.running || rdapCandidates.length === 0}
          >
            {t("page.rdap.action.run")}
          </Button>
          <Button variant="text" onClick={() => dispatch({ type: "process/reset" })}>
            {t("page.rdap.action.reset")}
          </Button>
        </Stack>
        {rdap.errorKey ? <Alert severity="error">{t(rdap.errorKey)}</Alert> : null}
        {rows.length === 0 ? (
          <Alert severity="info">{t("page.rdap.placeholder.noDns")}</Alert>
        ) : null}
        {rows.length > 0 && rdapCandidates.length === 0 ? (
          <Alert severity="info">{t("page.rdap.placeholder.noTarget")}</Alert>
        ) : null}
      </Paper>

      {rdap.running ? (
        <Paper elevation={1} sx={{ p: 2 }}>
          <LinearProgress variant="determinate" value={progressValue} />
        </Paper>
      ) : null}

      <Paper
        elevation={1}
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        <Box sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6">
            {t("page.rdap.table.title")}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            disableVirtualization={rows.length <= 200}
            loading={rdap.running}
            pagination
            getRowHeight={() => "auto"}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            pageSizeOptions={[25, 50, 100]}
            aria-label={t("page.rdap.table.title")}
            localeText={{
              noRowsLabel: t("page.rdap.table.empty"),
              footerTotalRows: t("page.rdap.table.total", { count: rows.length })
            }}
            sx={{
              flexGrow: 1,
              border: "none",
              "& .MuiDataGrid-columnHeaders": {
                position: "sticky",
                top: 0,
                zIndex: (theme) => theme.zIndex.modal + 1,
                bgcolor: "background.paper"
              },
              "& .MuiDataGrid-virtualScroller": {
                overflowY: "auto"
              }
            }}
          />
        </Box>
      </Paper>
    </>
  );
}

interface SidebarStatProps {
  label: string;
  value: number;
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

interface RdapStatsSummary {
  total: number;
  checked: number;
  pending: number;
  available: number;
  taken: number;
  rateLimited: number;
}

function buildRdapStats(
  candidates: DomainCheckRow[],
  checked: number
): RdapStatsSummary {
  const summary: RdapStatsSummary = {
    total: candidates.length,
    checked,
    pending: Math.max(candidates.length - checked, 0),
    available: 0,
    taken: 0,
    rateLimited: 0
  };

  candidates.forEach((row) => {
    if (row.verdict === "available") {
      summary.available += 1;
    }
    if (row.verdict === "taken") {
      summary.taken += 1;
    }
    if (row.rdap === 429) {
      summary.rateLimited += 1;
    }
  });

  return summary;
}

function mapDnsChipColor(status: DomainCheckRow["dns"]) {
  switch (status) {
    case "has-ns":
      return "success" as const;
    case "no-ns":
    case "nxdomain":
      return "warning" as const;
    case "error":
    default:
      return "default" as const;
  }
}

function mapRdapChipColor(status: DomainCheckRow["rdap"]) {
  if (status === null) {
    return "default" as const;
  }
  return RDAP_STAGE_COLORS[status] ?? "info";
}

function mapVerdictChipColor(verdict: DomainCheckRow["verdict"]) {
  switch (verdict) {
    case "taken":
      return "error" as const;
    case "available":
      return "success" as const;
    case "rdap-unsupported":
      return "info" as const;
    case "undetermined":
    default:
      return "default" as const;
  }
}
