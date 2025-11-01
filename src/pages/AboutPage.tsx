import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LaunchIcon from "@mui/icons-material/Launch";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import HighlightOffRoundedIcon from "@mui/icons-material/HighlightOffRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Grid2 from "@mui/material/PigmentGrid"; // 使用 Grid2 Pigment 版本以满足新版 API
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const REPO_URL = "https://github.com/domiro-org/web";

/**
 * 关于页组件，集中展示项目信息与许可提示。
 */
export default function AboutPage() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // 预先构建许可条款分组，方便渲染
  const licenseSections = useMemo(
    () => [
      {
        title: t("page.about.license.permissions.title"),
        icon: <CheckCircleOutlineRoundedIcon color="success" />, // 使用成功图标表示许可
        items: [
          t("page.about.license.permissions.items.commercial"),
          t("page.about.license.permissions.items.modification"),
          t("page.about.license.permissions.items.distribution"),
          t("page.about.license.permissions.items.patent"),
          t("page.about.license.permissions.items.private")
        ]
      },
      {
        title: t("page.about.license.limitations.title"),
        icon: <HighlightOffRoundedIcon color="error" />, // 使用错误图标表示限制
        items: [
          t("page.about.license.limitations.items.liability"),
          t("page.about.license.limitations.items.warranty")
        ]
      },
      {
        title: t("page.about.license.conditions.title"),
        icon: <InfoOutlinedIcon color="info" />, // 使用信息图标表示条件
        items: [
          t("page.about.license.conditions.items.notice"),
          t("page.about.license.conditions.items.stateChanges"),
          t("page.about.license.conditions.items.discloseSource"),
          t("page.about.license.conditions.items.networkUse"),
          t("page.about.license.conditions.items.sameLicense")
        ]
      }
    ],
    [t]
  );

  // 使用响应式网格将许可信息分成三列展示，提升空间利用率
  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h4" gutterBottom>
              {t("page.about.title")}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t("page.about.summary")}
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Button
              variant="contained"
              color="primary"
              component={Link}
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<LaunchIcon />}
            >
              {t("page.about.action.visitRepo")}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t("page.about.license.heading")}</Typography>
          <Typography variant="body1" color="text.secondary">
            {t("page.about.license.summary")}
          </Typography>
          <div>
            <Button
              variant="text"
              size="small"
              onClick={() => setExpanded((prev) => !prev)}
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {expanded
                ? t("page.about.license.action.hide")
                : t("page.about.license.action.showDetails")}
            </Button>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {t("page.about.license.description")}
              </Typography>
            </Collapse>
          </div>
          <Grid2 container spacing={2}>
            {licenseSections.map((section) => (
              <Grid2 size={{ xs: 12, sm: 6, md: 4 }} key={section.title}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {section.icon}
                    <Typography variant="subtitle1" color="text.primary">
                      {section.title}
                    </Typography>
                  </Stack>
                  <Stack spacing={0.5} sx={{ pl: 4 }}>
                    {section.items.map((item) => (
                      <Typography key={item} variant="body2" color="text.primary">
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                </Stack>
              </Grid2>
            ))}
          </Grid2>
        </Stack>
      </Paper>
    </Stack>
  );
}
