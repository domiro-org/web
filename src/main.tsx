
import ReactDOM from "react-dom/client";
import App from "./App";

import { extendTheme, CssVarsProvider } from "@mui/material/styles";

const theme = extendTheme({
  cssVarPrefix: "md",
  colorSchemes: {
    light: true,
    dark: true,
  },
  typography: {
    fontFamily: "Roboto, system-ui, sans-serif",
  },
  shape: {
    borderRadius: 12, // MD3 推荐更大圆角
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <CssVarsProvider theme={theme}>
    <App />
  </CssVarsProvider>
);
