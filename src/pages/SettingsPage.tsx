import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useWideShellSidebar } from "../layouts/WideShell";

/**
 * 设置页占位，后续补充具体配置项。
 */
export default function SettingsPage() {
  const { t } = useTranslation();

  useWideShellSidebar(null);

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t("page.settings.title")}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {t("page.settings.description")}
      </Typography>
    </Paper>
  );
}
