import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

declare const process: {
  cwd: () => string
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [react()],
    define: {
      "import.meta.env.ENABLE_UMAMI": JSON.stringify(env.ENABLE_UMAMI ?? "false"),
      "import.meta.env.UMAMI_SRC": JSON.stringify(
        env.UMAMI_SRC ?? "https://umami.alexma.top/script.js",
      ),
      "import.meta.env.UMAMI_SITE_ID": JSON.stringify(
        env.UMAMI_SITE_ID ?? "99c45cb5-27da-401e-91f6-a264580de03a",
      ),
    },
  }
})
