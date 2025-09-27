import {
  Container,
  Typography,
  Button,
  TextField,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import LanguageSwitcher from "./components/LanguageSwitcher";
import type {
  DomainParseErrorCode,
  DomainParseResult
} from "./utils/parseDomains";
import { parseDomains } from "./utils/parseDomains";
import type { DomainCheckRow, Verdict, CheckState } from "./utils/domainCheckTypes";
import { runDnsPrecheck } from "./utils/dnsPrecheck";
import { runRdapCheck, type RdapCheckResult } from "./utils/rdapCheck";

const ERROR_MESSAGE_KEYS: Record<DomainParseErrorCode, string> = {
  "invalid-format": "parse.errors.invalid-format",
  "invalid-length": "parse.errors.invalid-length",
  "no-tld": "parse.errors.no-tld",
  duplicate: "parse.errors.duplicate"
};

const DNS_STATUS_KEYS: Record<DomainCheckRow["dns"], string> = {
  "has-ns": "dns.status.has-ns",
  "no-ns": "dns.status.no-ns",
  nxdomain: "dns.status.nxdomain",
  error: "dns.status.error"
};

const VERDICT_KEYS: Record<Verdict, string> = {
  available: "verdict.available",
  taken: "verdict.taken",
  undetermined: "verdict.undetermined",
  "rdap-unsupported": "verdict.rdap-unsupported"
};

export default function App() {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const [parseResult, setParseResult] = useState<DomainParseResult | null>(
    null
  );
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [rows, setRows] = useState<DomainCheckRow[]>([]);
  const [rdapCheckedCount, setRdapCheckedCount] = useState(0);
  const [errorMessageKey, setErrorMessageKey] = useState<string | null>(null);
  const runIdRef = useRef(0);

  // 点击按钮后执行解析流程
  const handleCheck = async () => {
    const result = parseDomains(inputValue);
    setParseResult(result);
    setRows([]);
    setErrorMessageKey(null);
    setRdapCheckedCount(0);

    if (result.domains.length === 0) {
      setCheckState("idle");
      return;
    }

    const currentRunId = runIdRef.current + 1;
    runIdRef.current = currentRunId;
    setCheckState("dns-checking");

    let dnsRows: DomainCheckRow[];

    try {
      dnsRows = await runDnsChecks(result.domains, t);
    } catch (error) {
      console.error("DNS precheck failed", error);
      if (runIdRef.current === currentRunId) {
        setCheckState("error");
        setErrorMessageKey("dns.error.general");
      }
      return;
    }

    if (runIdRef.current !== currentRunId) {
      return;
    }

    setRows(dnsRows);

    let finalRows = dnsRows;
    const rdapCandidates = dnsRows.filter((row) => shouldRunRdap(row.dns));

    if (rdapCandidates.length > 0) {
      setCheckState("rdap-checking");

      try {
        finalRows = await runRdapChecks(dnsRows, t);
      } catch (error) {
        console.error("RDAP check failed", error);
        if (runIdRef.current === currentRunId) {
          setCheckState("error");
          setErrorMessageKey("rdap.error.general");
        }
        return;
      }

      if (runIdRef.current !== currentRunId) {
        return;
      }

      setRows(finalRows);
      setRdapCheckedCount(
        finalRows.filter((row) => row.rdap !== null).length
      );
    }

    if (runIdRef.current !== currentRunId) {
      return;
    }

    setCheckState("done");
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t("app.title")}
      </Typography>

      <LanguageSwitcher fullWidth sx={{ mb: 2 }} />

      <TextField
        fullWidth
        placeholder={t("input.placeholder")}
        helperText={t("input.helper")}
        multiline
        minRows={4}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        sx={{ mb: 2 }}
      />
      <Button
        variant="contained"
        onClick={handleCheck}
        disabled={!inputValue.trim()}
      >
        {t("action.check")}
      </Button>

      {parseResult && (
        <Stack spacing={3} sx={{ mt: 3 }}>
          {parseResult.domains.length > 0 ? (
            <Stack spacing={1}>
              <Alert severity="success">
                {t("parse.summary", { count: parseResult.domains.length })}
              </Alert>
              <List dense disablePadding>
                {parseResult.domains.map((domain) => (
                  <ListItem key={domain.id}>
                    <ListItemText
                      primary={domain.domain}
                      secondary={
                        domain.ascii !== domain.domain ? domain.ascii : undefined
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Stack>
          ) : (
            <Alert severity="info">{t("parse.empty")}</Alert>
          )}

          {parseResult.errors.length > 0 && (
            <Alert severity="warning">
              <Stack spacing={1}>
                <Typography variant="subtitle2">
                  {t("parse.errors.title", {
                    count: parseResult.errors.length
                  })}
                </Typography>
                <List dense disablePadding>
                  {parseResult.errors.map((error, index) => (
                    <ListItem key={`${error.input}-${error.code}-${index}`}>
                      <ListItemText
                        primary={error.input}
                        secondary={t(ERROR_MESSAGE_KEYS[error.code])}
                      />
                    </ListItem>
                  ))}
                </List>
              </Stack>
            </Alert>
          )}

          {parseResult.domains.length > 0 && (
            <Stack spacing={2}>
              {checkState === "dns-checking" && (
                <Alert severity="info">
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      {t("dns.checking")}
                    </Typography>
                    <LinearProgress />
                  </Stack>
                </Alert>
              )}

              {checkState === "rdap-checking" && (
                <Alert severity="info">
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      {t("rdap.checking")}
                    </Typography>
                    <LinearProgress />
                  </Stack>
                </Alert>
              )}

              {checkState === "error" && (
                <Alert severity="error">
                  {t(errorMessageKey ?? "dns.error.general")}
                </Alert>
              )}

              {checkState === "done" && rows.length > 0 && (
                <Stack spacing={1}>
                  <Alert severity="success">
                    {t("dns.done", { count: rows.length })}
                  </Alert>
                  {rdapCheckedCount > 0 && (
                    <Alert severity="success">
                      {t("rdap.done", { count: rdapCheckedCount })}
                    </Alert>
                  )}
                </Stack>
              )}

              <TableContainer component={Paper} variant="outlined">
                <Table size="small" aria-label={t("dns.table.aria") ?? "DNS"}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("dns.table.domain")}</TableCell>
                      <TableCell>{t("dns.table.dns")}</TableCell>
                      <TableCell>{t("dns.table.verdict")}</TableCell>
                      <TableCell>{t("dns.table.detail")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary">
                            {checkState === "dns-checking" ||
                            checkState === "rdap-checking"
                              ? t("dns.table.pending")
                              : t("dns.table.empty")}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <Typography variant="body2">
                                {row.domain}
                              </Typography>
                              {row.ascii !== row.domain && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {row.ascii}
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ color: getDnsColor(row.dns) }}
                            >
                              {t(DNS_STATUS_KEYS[row.dns])}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ color: getVerdictColor(row.verdict) }}
                            >
                              {t(VERDICT_KEYS[row.verdict])}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {row.detail ? (
                              <Typography variant="body2">{row.detail}</Typography>
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {t("dns.table.detail-empty")}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </Stack>
      )}
    </Container>
  );
}

function getDnsColor(status: DomainCheckRow["dns"]) {
  switch (status) {
    case "has-ns":
      return "success.main";
    case "no-ns":
    case "nxdomain":
      return "warning.main";
    case "error":
    default:
      return "error.main";
  }
}

function getVerdictColor(verdict: Verdict) {
  switch (verdict) {
    case "taken":
      return "success.main";
    case "available":
      return "warning.main";
    case "rdap-unsupported":
      return "text.secondary";
    case "undetermined":
    default:
      return "text.primary";
  }
}

async function runDnsChecks(
  domains: DomainParseResult["domains"],
  t: TFunction
): Promise<DomainCheckRow[]> {
  // 并发依赖 Promise.all，在 M1 再补并发控制
  const results = await Promise.all(
    domains.map(async (domain) => {
      try {
        const dnsResult = await runDnsPrecheck(domain.ascii);
        const providerLabel = dnsResult.provider
          ? t(`dns.provider.${dnsResult.provider}`)
          : t("dns.provider.unknown");
        const detail = dnsResult.detail
          ? t(dnsResult.detail)
          : t("dns.detail.source", { provider: providerLabel });

        return {
          id: domain.id,
          domain: domain.domain,
          ascii: domain.ascii,
          tld: domain.tld,
          dns: dnsResult.status,
          rdap: null,
          verdict: deriveDnsVerdict(dnsResult.status),
          detail
        } satisfies DomainCheckRow;
      } catch (error) {
        console.error("runDnsPrecheck error", error);
        return {
          id: domain.id,
          domain: domain.domain,
          ascii: domain.ascii,
          tld: domain.tld,
          dns: "error",
          rdap: null,
          verdict: "undetermined",
          detail: t("dns.detail.unknown-error")
        } satisfies DomainCheckRow;
      }
    })
  );

  return results;
}

async function runRdapChecks(
  rows: DomainCheckRow[],
  t: TFunction
): Promise<DomainCheckRow[]> {
  const rdapSourceLabel = t("rdap.source.rdap-org");
  const rdapSourceDetail = t("rdap.detail.source", { source: rdapSourceLabel });

  const nextRows = await Promise.all(
    rows.map(async (row) => {
      if (!shouldRunRdap(row.dns)) {
        return row;
      }

      try {
        const rdapResult = await runRdapCheck(row.ascii);
        const rdapDetail = mergeDetails(
          rdapSourceDetail,
          t(rdapResult.detailKey, rdapResult.detailParams)
        );

        return {
          ...row,
          rdap: rdapResult.status,
          verdict: deriveVerdictWithRdap(row.dns, rdapResult),
          detail: mergeDetails(row.detail, rdapDetail)
        } satisfies DomainCheckRow;
      } catch (error) {
        console.error("runRdapCheck error", error);
        return {
          ...row,
          rdap: null,
          verdict: deriveVerdictWithRdap(row.dns, null),
          detail: mergeDetails(row.detail, t("rdap.detail.network-error"))
        } satisfies DomainCheckRow;
      }
    })
  );

  return nextRows;
}

function shouldRunRdap(status: DomainCheckRow["dns"]): boolean {
  return status === "no-ns" || status === "nxdomain";
}

function mergeDetails(
  baseDetail?: string,
  appendDetail?: string
): string | undefined {
  if (baseDetail && appendDetail) {
    return `${baseDetail} · ${appendDetail}`;
  }

  return appendDetail ?? baseDetail;
}

function deriveDnsVerdict(status: DomainCheckRow["dns"]): Verdict {
  if (status === "has-ns") {
    return "taken";
  }

  if (status === "error") {
    return "undetermined";
  }

  return "available";
}

function deriveVerdictWithRdap(
  status: DomainCheckRow["dns"],
  rdap: RdapCheckResult | null
): Verdict {
  if (rdap === null) {
    if (status === "has-ns") {
      return "taken";
    }
    if (status === "error") {
      return "undetermined";
    }
    return "undetermined";
  }

  if (rdap.unsupported) {
    return "rdap-unsupported";
  }

  if (rdap.available === true) {
    return "available";
  }

  if (rdap.available === false) {
    return "taken";
  }

  if (rdap.status === 429) {
    return "undetermined";
  }

  return deriveDnsVerdict(status);
}
