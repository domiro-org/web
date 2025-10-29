import Alert from "@mui/material/Alert";
import CssBaseline from "@mui/material/CssBaseline";
import Snackbar from "@mui/material/Snackbar";
import { CssVarsProvider, useColorScheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useCallback, useEffect, useMemo, type PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

import { AppStateProvider, useAppDispatch, useAppState } from "./shared/hooks/useAppState";
import AppRoutes from "./routes/AppRoutes";
import { createAppTheme } from "./theme/theme";
import type { ThemeMode } from "./shared/types";

/**
 * 顶层应用组件：注入状态、主题与路由。
 */
export default function App() {
  return (
    <AppStateProvider>
      <AppThemeProvider>
        <AppWithSnackbar />
      </AppThemeProvider>
    </AppStateProvider>
  );
}

function AppThemeProvider({ children }: PropsWithChildren) {
  const { settings } = useAppState();
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const theme = useMemo(
    () =>
      createAppTheme({
        colorId: settings.themeColor,
        customColor: settings.customPrimaryColor
      }),
    [settings.customPrimaryColor, settings.themeColor]
  );

  const targetMode = useMemo<Exclude<ThemeMode, "system">>(() => {
    if (settings.themeMode === "system") {
      return prefersDark ? "dark" : "light";
    }
    return settings.themeMode;
  }, [prefersDark, settings.themeMode]);

  return (
    <CssVarsProvider
      theme={theme}
      defaultMode="system"
      modeStorageKey="domiro-mode"
    >
      <CssBaseline enableColorScheme />
      <ThemeModeSynchronizer mode={targetMode} />
      {children}
    </CssVarsProvider>
  );
}

function ThemeModeSynchronizer({ mode }: { mode: Exclude<ThemeMode, "system"> }) {
  const { setMode, mode: currentMode } = useColorScheme();

  useEffect(() => {
    if (!setMode) {
      return;
    }

    // 监听设置变更，强制将 CssVarsProvider 切换到目标模式
    if (currentMode !== mode) {
      setMode(mode);
    }
  }, [currentMode, mode, setMode]);

  return null;
}

function AppWithSnackbar() {
  const { ui } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const handleClose = useCallback(() => {
    dispatch({ type: "ui/snackbar", payload: null });
  }, [dispatch]);

  return (
    <>
      <AppRoutes />
      {ui.snackbar ? (
        <Snackbar
          open
          autoHideDuration={4000}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={ui.snackbar.severity}
            onClose={handleClose}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {t(ui.snackbar.messageKey, ui.snackbar.messageParams)}
          </Alert>
        </Snackbar>
      ) : null}
    </>
  );
}
