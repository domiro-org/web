import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface StatsEntry {
  label: string;
  value: ReactNode;
}

interface StatsCardProps {
  titleKey?: string;
  stats: StatsEntry[];
}

interface HintCardProps {
  i18nKey: string;
}

/**
 * 侧栏统计卡片，按两列布局呈现指标。
 */
export function StatsCard({ titleKey, stats }: StatsCardProps) {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: 3 }}>
      {titleKey ? (
        <Typography variant="subtitle1" gutterBottom>
          {t(titleKey)}
        </Typography>
      ) : null}
      <Stack spacing={1.25}>
        {stats.map((item) => (
          <Stack
            key={`${item.label}`}
            direction="row"
            alignItems="baseline"
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="body1" fontWeight={600} textAlign="right">
              {item.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

/**
 * 提示卡片，读取统一的提示文案结构。
 */
export function HintCard({ i18nKey }: HintCardProps) {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        {t(`${i18nKey}.title`)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(`${i18nKey}.body`)}
      </Typography>
    </Paper>
  );
}
