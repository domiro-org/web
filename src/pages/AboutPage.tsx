import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useWideShellSidebar } from "../layouts/WideShellContext";

interface LicenseColumn {
  icon: ReactElement;
  title: string;
  items: string[];
}

/**
 * 关于页：展示项目来源与许可证信息。
 */
export default function AboutPage() {
  const { t } = useTranslation();

  // 关于页无需右侧栏，保持内容居中呈现
  useWideShellSidebar(false);

  // 通过 useMemo 避免每次渲染都重新生成列配置
  const licenseColumns = useMemo<LicenseColumn[]>(
    () => [
      {
        icon: (
          <CheckCircleOutlineRoundedIcon color="success" fontSize="small" />
        ),
        title: t("page.about.license.permissions"),
        items: [
          t("page.about.license.items.commercial"),
          t("page.about.license.items.modification"),
          t("page.about.license.items.distribution"),
          t("page.about.license.items.patent"),
          t("page.about.license.items.private")
        ]
      },
      {
        icon: <BlockRoundedIcon color="error" fontSize="small" />,
        title: t("page.about.license.limitations"),
        items: [
          t("page.about.license.items.liability"),
          t("page.about.license.items.warranty")
        ]
      },
      {
        icon: <InfoOutlinedIcon color="info" fontSize="small" />,
        title: t("page.about.license.conditions"),
        items: [
          t("page.about.license.items.notice"),
          t("page.about.license.items.stateChanges"),
          t("page.about.license.items.discloseSource"),
          t("page.about.license.items.networkUse"),
          t("page.about.license.items.sameLicense")
        ]
      }
    ],
    [t]
  );

  return (
    <Stack spacing={3}>
      <Paper elevation={1} sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Typography variant="h4">{t("page.about.title")}</Typography>
          <Typography variant="body1" color="text.secondary">
            {t("page.about.description")}
          </Typography>
          <Box>
            <Button
              component="a"
              href={t("page.about.repoUrl")}
              target="_blank"
              rel="noopener"
              variant="contained"
            >
              {t("page.about.repoButton")}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack spacing={1}>
            <Typography variant="h6">
              {t("page.about.license.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("page.about.license.summary")}
            </Typography>
          </Stack>

          <Grid container spacing={2}>
            {licenseColumns.map((column) => (
              <Grid key={column.title} size={{ xs: 12, md: 4 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {column.icon}
                    <Typography variant="subtitle2">
                      {column.title}
                    </Typography>
                  </Stack>
                  <Stack component="ul" spacing={1} sx={{ listStyle: "none", m: 0, p: 0 }}>
                    {column.items.map((item) => (
                      <Typography key={item} component="li" variant="body2">
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                </Stack>
              </Grid>
            ))}
          </Grid>

          <Accordion elevation={0} disableGutters sx={{ bgcolor: "transparent" }}>
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
              <Typography variant="body2" fontWeight={600}>
                {t("page.about.license.expand")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary">
                {t("page.about.license.details")}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </Paper>
    </Stack>
  );
}
