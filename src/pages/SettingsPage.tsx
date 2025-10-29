import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useWideShellSidebar } from "../layouts/WideShellContext";
import { useAppDispatch, useAppState } from "../shared/hooks/useAppState";
import type { DohProviderId, ThemeColorId, ThemeMode } from "../shared/types";
import { THEME_COLOR_OPTIONS } from "../theme/colorPresets";

//
// 设置页：承载运行参数（DoH 与 DNS/RDAP 并发）
// 该内容从“导出结果”页面迁移至此，便于信息架构更清晰。
//

const PROVIDER_ORDER: DohProviderId[] = ["google", "cloudflare"]; // 展示顺序固定
const DNS_CONCURRENCY_MARKS = [
  { value: 200, label: "200" },
  { value: 1000, label: "1000" },
  { value: 5000, label: "5000" }
];
const hiddenRadioSx = {
  position: "absolute" as const,
  opacity: 0,
  pointerEvents: "none"
};

/**
 * 设置页，提供运行参数配置。
 */
export default function SettingsPage() {
  const { t } = useTranslation();
  const { settings } = useAppState();
  const dispatch = useAppDispatch();

  // 需至少保留一个 DoH 提供商
  const [providerError, setProviderError] = useState(false);

  useWideShellSidebar(false);

  const handleThemeModeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextMode = event.target.value as ThemeMode;
      if (nextMode === "system" || nextMode === "light" || nextMode === "dark") {
        dispatch({ type: "settings/update", payload: { themeMode: nextMode } });
      }
    },
    [dispatch]
  );

  const handleThemeColorChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextColor = event.target.value as ThemeColorId;
      if (!THEME_COLOR_OPTIONS.some((option) => option.id === nextColor)) {
        return;
      }

      dispatch({ type: "settings/update", payload: { themeColor: nextColor } });
    },
    [dispatch]
  );

  const handleCustomColorChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value.toUpperCase();
      const nextColor = value.startsWith("#") ? value : `#${value}`;
      dispatch({
        type: "settings/update",
        payload: { customPrimaryColor: nextColor }
      });
    },
    [dispatch]
  );

  // 处理 DoH 提供商勾选变更
  const handleProviderToggle = useCallback(
    (provider: DohProviderId) => (_event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
      if (!checked && settings.dohProviders.length === 1 && settings.dohProviders[0] === provider) {
        setProviderError(true);
        return;
      }

      setProviderError(false);
      const nextProviders = checked
        ? sortProviders([...settings.dohProviders, provider])
        : settings.dohProviders.filter((item) => item !== provider);
      dispatch({ type: "settings/update", payload: { dohProviders: nextProviders } });
    },
    [dispatch, settings.dohProviders]
  );

  // RDAP 并发滑块
  const handleRdapConcurrencyChange = useCallback(
    (_event: Event, value: number | number[]) => {
      const nextValue = Array.isArray(value) ? value[0] : value;
      dispatch({ type: "settings/update", payload: { rdapConcurrency: nextValue } });
    },
    [dispatch]
  );

  // DNS 并发滑块
  const handleDnsConcurrencyChange = useCallback(
    (_event: Event, value: number | number[]) => {
      const nextValue = Array.isArray(value) ? value[0] : value;
      dispatch({ type: "settings/update", payload: { dnsConcurrency: nextValue } });
    },
    [dispatch]
  );

  // 动态提示当前并发值
  const rdapHelperText = useMemo(
    () => t("page.export.settings.rdapHelper", { value: settings.rdapConcurrency }),
    [settings.rdapConcurrency, t]
  );
  const dnsHelperText = useMemo(
    () => t("page.export.settings.dnsHelper", { value: settings.dnsConcurrency }),
    [settings.dnsConcurrency, t]
  );

  return (
    <>
      <Paper elevation={1} sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Typography variant="h4">{t("page.settings.title")}</Typography>
          <Typography variant="body1" color="text.secondary">
            {t("page.settings.description")}
          </Typography>
        </Stack>
      </Paper>

      <Paper
        elevation={1}
        sx={{
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 3
        }}
      >
        <Stack spacing={1}>
          <Typography variant="h6">{t("page.settings.theme.title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("page.settings.theme.description")}
          </Typography>
        </Stack>

        <FormControl component="fieldset">
          <FormLabel component="legend">{t("page.settings.theme.modeLabel")}</FormLabel>
          <RadioGroup
            row
            name="theme-mode"
            value={settings.themeMode}
            onChange={handleThemeModeChange}
            sx={{ mt: 1 }}
          >
            <FormControlLabel
              value="system"
              control={<Radio />}
              label={t("page.settings.theme.mode.system")}
            />
            <FormControlLabel
              value="light"
              control={<Radio />}
              label={t("page.settings.theme.mode.light")}
            />
            <FormControlLabel
              value="dark"
              control={<Radio />}
              label={t("page.settings.theme.mode.dark")}
            />
          </RadioGroup>
        </FormControl>

        <FormControl component="fieldset" variant="standard">
          <FormLabel component="legend">{t("page.settings.theme.colorLabel")}</FormLabel>
          <RadioGroup
            name="theme-color"
            value={settings.themeColor}
            onChange={handleThemeColorChange}
            sx={{ mt: 1 }}
          >
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                  xs: "repeat(1, minmax(0, 1fr))",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(3, minmax(0, 1fr))"
                }
              }}
            >
              {THEME_COLOR_OPTIONS.map((option) => {
                const isSelected = settings.themeColor === option.id;
                const swatchColor = option.isCustom ? settings.customPrimaryColor : option.preview;

                return (
                  <Paper
                    key={option.id}
                    component="label"
                    variant="outlined"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 1.5,
                      py: 1.25,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? "primary.main" : "divider",
                      boxShadow: isSelected
                        ? (theme) => `0 0 0 2px ${theme.palette.primary.container}`
                        : "none",
                      transition: (theme) =>
                        theme.transitions.create(["border-color", "box-shadow"], {
                          duration: theme.transitions.duration.shorter
                        }),
                      cursor: "pointer"
                    }}
                  >
                    <Radio value={option.id} sx={hiddenRadioSx} />
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "1px solid",
                        borderColor: "divider",
                        backgroundColor: swatchColor,
                        flexShrink: 0
                      }}
                    />
                    <Typography variant="body2">{t(option.labelKey)}</Typography>
                  </Paper>
                );
              })}
            </Box>
          </RadioGroup>
          {settings.themeColor === "custom" ? (
            <Stack spacing={1} sx={{ mt: 2 }}>
              <TextField
                type="color"
                label={t("page.settings.theme.customLabel")}
                value={settings.customPrimaryColor}
                onChange={handleCustomColorChange}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", sm: 180 } }}
              />
              <FormHelperText>{t("page.settings.theme.customHelper")}</FormHelperText>
            </Stack>
          ) : null}
        </FormControl>
      </Paper>

      <Paper
        elevation={1}
        sx={{
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          flexGrow: 1,
          minHeight: 0
        }}
      >
        <Typography variant="h6">{t("page.export.settings.title")}</Typography>

        <FormControl component="fieldset" error={providerError} variant="standard">
          <FormLabel component="legend">{t("page.export.settings.dohLabel")}</FormLabel>
          <FormGroup row>
            {PROVIDER_ORDER.map((provider) => (
              <FormControlLabel
                key={provider}
                control={
                  <Checkbox
                    checked={settings.dohProviders.includes(provider)}
                    onChange={handleProviderToggle(provider)}
                  />
                }
                label={t(`page.export.settings.provider.${provider}`)}
              />
            ))}
          </FormGroup>
          <FormHelperText>
            {providerError && t("page.export.settings.providerError")}
          </FormHelperText>
          {!providerError && (
            <FormHelperText>{t("page.export.settings.dohHelper")}</FormHelperText>
          )}
        </FormControl>

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <FormLabel component="legend">
              {t("page.export.settings.rdapConcurrency")}
            </FormLabel>
            <Typography variant="body2" color="text.secondary">
              {rdapHelperText}
            </Typography>
          </Stack>
          <Slider
            value={settings.rdapConcurrency}
            min={1}
            max={12}
            step={1}
            marks
            valueLabelDisplay="auto"
            onChange={handleRdapConcurrencyChange}
          />
        </Box>

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <FormLabel component="legend">
              {t("page.export.settings.dnsConcurrency")}
            </FormLabel>
            <Typography variant="body2" color="text.secondary">
              {dnsHelperText}
            </Typography>
          </Stack>
          <Slider
            value={settings.dnsConcurrency}
            min={200}
            max={5000}
            step={100}
            marks={DNS_CONCURRENCY_MARKS}
            valueLabelDisplay="auto"
            onChange={handleDnsConcurrencyChange}
          />
        </Box>

      </Paper>
    </>
  );
}

/**
 * 将 DoH 提供者按既定顺序排序，确保展示一致。
 * @param providers 选中的提供者列表
 * @returns 排序后的提供者列表
 */
function sortProviders(providers: DohProviderId[]): DohProviderId[] {
  return PROVIDER_ORDER.filter((provider) => providers.includes(provider));
}
