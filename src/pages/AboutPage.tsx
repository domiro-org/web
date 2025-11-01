import LaunchIcon from "@mui/icons-material/Launch";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

const REPO_URL = "https://github.com/domiro-org/web";
const LICENSE_URL = "https://www.gnu.org/licenses/agpl-3.0";

/**
 * 关于页组件，集中展示项目信息与许可提示。
 */
export default function AboutPage() {
  const { t } = useTranslation();

  // 使用 useMemo 缓存状态提示列表，避免重复创建对象
  const statusItems = useMemo(
    () => [
      { icon: "✔️", text: t("page.about.status.openSource") },
      { icon: "ℹ️", text: t("page.about.status.agpl") },
      { icon: "❌", text: t("page.about.status.restriction") }
    ],
    [t]
  );

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
            <Button
              variant="outlined"
              component={Link}
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<LaunchIcon />}
            >
              {t("page.about.action.readLicense")}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t("page.about.section.metadata")}</Typography>
          <Stack spacing={1}>
            <MetadataRow label={t("page.about.metadata.repository")}>{REPO_URL}</MetadataRow>
            <MetadataRow label={t("page.about.metadata.license")}>AGPL-3.0</MetadataRow>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t("page.about.section.highlights")}</Typography>
          <Stack spacing={1.5}>
            {statusItems.map((item) => (
              <Stack key={item.text} direction="row" spacing={1} alignItems="flex-start">
                <Typography component="span" variant="body1" sx={{ fontSize: 22 }}>
                  {item.icon}
                </Typography>
                <Typography variant="body1" color="text.primary">
                  {item.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

interface MetadataRowProps {
  label: string;
  children: ReactNode;
}

/**
 * 元数据行组件，统一展示标签与内容。
 */
function MetadataRow({ label, children }: MetadataRowProps) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={0.5}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: { sm: 160 }, fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" color="text.primary">
        {children}
      </Typography>
    </Stack>
  );
}
