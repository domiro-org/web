import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { injectUmamiScript } from "./shared/utils/umami";

import App from "./App";
import "./i18n/i18n";

const shouldInjectUmami = import.meta.env.ENABLE_UMAMI === "true";

if (shouldInjectUmami && import.meta.env.UMAMI_SRC && import.meta.env.UMAMI_SITE_ID) {
  // 根据环境变量决定是否注入 Umami 统计脚本
  injectUmamiScript(import.meta.env.UMAMI_SRC, import.meta.env.UMAMI_SITE_ID);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
