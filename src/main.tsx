import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { CssVarsProvider } from "@mui/material/styles";

import theme from "./theme/theme";

import App from "./App";
import "./i18n/i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CssVarsProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <App />
    </CssVarsProvider>
  </StrictMode>
);
