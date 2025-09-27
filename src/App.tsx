import Alert from "@mui/material/Alert";
import CssBaseline from "@mui/material/CssBaseline";
import Snackbar from "@mui/material/Snackbar";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { AppStateProvider, useAppDispatch, useAppState } from "./shared/hooks/useAppState";
import AppRoutes from "./routes/AppRoutes";

/**
 * 顶层应用组件：注入状态、主题与路由。
 */
export default function App() {
  return (
    <AppStateProvider>
      <CssBaseline />
      <AppWithSnackbar />
    </AppStateProvider>
  );
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
