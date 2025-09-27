# M0：能跑起来的 MVP（先闭环）

## ✅ To-do

1. **语言切换已就绪**（已完成）
2. **输入 → 解析域名列表**
3. **DNS 预筛（DoH 查 NS/SOA）**
4. **RDAP 二次判定**
5. **结果表格渲染 + 导出 CSV**
6. **最小错误提示与空态**

## 核心细节

- **输入格式**：每行一个域名；自动 `trim`、去重、过滤空行。
- **校验**：

  - 允许 IDN：`idna/punycode` 转换（`example.中国` ↔ `xn--…`）。
  - 只允许 `a-z 0-9 - .` 和 IDN（转换后再校验），禁止前后 `-`、禁止连续 `..`。

- **DoH（DNS over HTTPS）**：

  - 先查 `NS`（如无/`NXDOMAIN`/空 → “疑似可注册”），也可补一发 `SOA` 验证。
  - 建议两个后端择一：`https://dns.google/resolve?name={domain}&type=NS` 或 `https://cloudflare-dns.com/dns-query?name={domain}&type=NS`（Accept: `application/dns-json`）。

- **RDAP**：

  - 直接请求对应 TLD 的 RDAP（可先用 IANA 引导，也可直连常见 gTLD 提供商）。
  - 语义：`HTTP 404` → 未注册；`200` 且有 `objectClassName=domain` → 已注册；`429` → 照 `Retry-After` 退避重试。
  - 个别 ccTLD 无 RDAP 再做 **WHOIS 兜底**（M2 实装）。

- **数据结构（前端状态）**：

  ```ts
  type CheckState =
    | "idle"
    | "dns-checking"
    | "rdap-checking"
    | "done"
    | "error";
  type Verdict = "available" | "taken" | "undetermined" | "rdap-unsupported";

  interface Row {
    id: string; // uuid
    domain: string; // 原始/或显示用（保留大小写）
    ascii: string; // punycode 转换后
    dns: "has-ns" | "no-ns" | "nxdomain" | "error";
    rdap: number | null; // HTTP 状态码
    verdict: Verdict;
    detail?: string; // 错误或补充说明
    tld: string;
  }
  ```

- **UI（MUI）**：`TextField(multiline)` 输入 → `Button` 检查 → `Table` 展示（列：域名 / 结果 / 说明 / 导出）。
- **导出**：简单 `Blob` → CSV（UTF-8 with BOM，Excel 友好）。

---

# M1：可用性与健壮性（体验打磨）

## ✅ To-do

1. **并发控制与队列**（避免一次打爆 DoH/RDAP）
2. **退避重试**（处理 `429`、瞬时超时）
3. **缓存**（同会话内重复域名不再请求；LocalStorage 记忆短期结果）
4. **CORS 方案**（少数 RDAP 端点若不放行）
5. **i18n 补齐 + Weblate 回流测试**（翻译从 Weblate 推回仓库，页面可切换验证）

## 核心细节

- **并发**：建议最大同时 8–12；实现方式：自写 `p-limit` 队列或用轻量工具。
- **退避**：指数退避（如 0.5s → 1s → 2s → 4s，叠加 `Retry-After`），最大重试 3 次。
- **缓存策略**：

  - 内存 Map：`ascii → Row`；
  - LocalStorage（可设 24h 过期戳）；
  - 命中缓存直接渲染，并后台静默校验（可选）。

- **CORS**：

  - 先直接请求；若被拦，使用极薄代理（例如 Cloudflare Workers/Pages Functions）只转发必要头。
  - 环境变量化代理 URL（`VITE_API_PROXY`）。

- **可观测性**：简单 `console.groupCollapsed` 记录每个域名的 DoH/RDAP 请求与耗时；后续可换 `debug` 标志。

---

# M2：完整性与性能（高级能力）

## ✅ To-do

1. **WHOIS 兜底**（仅 RDAP 不可用的 ccTLD）
2. **TLD 识别/路由**（按 TLD 选择 RDAP/WHOIS 提供方）
3. **Web Worker**（批量检查不阻塞主线程）
4. **批量导入/导出**（导入 TXT/CSV，导出 JSON/CSV）
5. **快捷筛选**（只看“可注册”/“已注册”等）

## 核心细节

- **TLD 表**：初始化时构建一张 Map：`tld → { rdap: url | null, whois: host | null }`；可放在 `src/data/tldMap.ts`。
- **WHOIS**：

  - 浏览器里直连 43 端口不可行 → 通过同上代理（HTTP → TCP 转发），或用公共 HTTP-WHOIS API（需留意限速/合规）。
  - 只对明确无 RDAP 的 ccTLD 使用，解析文本提取「No match」「Not found」等关键字（按 TLD 定制）。

- **Worker 通信**：

  - 主线程投递 {id, ascii}，Worker 内部执行 DoH → RDAP → 回传 Row；
  - 通过 `postMessage` 分批 flush，避免一次性返回大量数据。

- **性能**：

  - 结果表格超过 200 行时用虚拟滚动（MUI DataGrid Pro 或轻量虚拟列表）。
  - 去抖 + 节流：输入框 400ms 去抖，避免频繁解析。

---

# M3：产品化与发布

## ✅ To-do

1. **设置（Settings）**：选择 DoH 提供商、并发数、是否使用代理、是否启用 WHOIS 兜底
2. **主题/外观**：深浅色、主色（MUI 主题）
3. **隐私与限额**：声明不收集域名数据；限制每次批量上限（如 1000 个）
4. **构建与发布**：

   - GitHub Actions：`npm ci && npm run build && upload artifact`
   - GitHub Pages / Cloudflare Pages 托管
   - （可选）Tauri 打包桌面版

5. **质量保障**：

   - E2E（Playwright）对核心流程：输入 → 检查 → 渲染
   - 单元测试（Vitest）对解析/判定函数
   - Prettier/ESLint/TypeScript 严格模式

6. **文档**：README 增加使用说明、隐私声明、FAQ；`CONTRIBUTING.md`；`TRANSLATION.md`（给译者指引）

## 核心细节

- **配置管理**：

  ```ts
  interface AppConfig {
    doh: "google" | "cloudflare";
    concurrent: number; // 8~12
    useProxy: boolean;
    proxyUrl?: string;
    whoisFallback: boolean;
  }
  ```

  从 `localStorage` 读取，UI 中修改即保存。

- **环境变量**：

  - `VITE_API_PROXY`（构建时注入）
  - `VITE_RDAP_BOOTSTRAP`（可选覆盖默认引导端点）

- **CI/CD**：

  - 分支保护：`main` 需要 CI 通过
  - 自动部署：推送 `main` → Pages 更新

- **Weblate**：

  - 保持 `weblate.yaml` 为真源；
  - 启用 Cleanup addon；
  - 翻译回流设置为 **自动 push** 或 **PR**（你选择其一）。

---

# 关键函数与判定（伪代码）

```ts
async function dohNS(
  domain: string
): Promise<"has-ns" | "no-ns" | "nxdomain" | "error"> {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(
    domain
  )}&type=NS`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) return "error";
  const data = await res.json();
  if (data.Status === 3) return "nxdomain"; // NXDOMAIN
  const answers = data.Answer?.filter((a: any) => a.type === 2) ?? [];
  return answers.length ? "has-ns" : "no-ns";
}

async function rdapCheck(
  domain: string
): Promise<{ status: number; available: boolean }> {
  const endpoint = pickRdapEndpoint(domain); // 按 TLD 选择
  const r = await fetch(`${endpoint}/domain/${encodeURIComponent(domain)}`);
  if (r.status === 404) return { status: 404, available: true };
  if (r.status === 429) throw new RetryAfterError(r.headers.get("retry-after"));
  return { status: r.status, available: false };
}

function verdictOf(
  dns: string,
  rdap: { status: number; available: boolean } | null
): Verdict {
  if (!rdap) return "undetermined";
  if (rdap.available) return "available";
  if (dns === "has-ns") return "taken";
  return "undetermined";
}
```

---

# 下一步建议（今天可做的 3 小点）

1. **实现输入解析 + punycode**（M0-2）
2. **写 DoH NS 查询函数**（M0-3）
3. **串上 RDAP 判定 + 显示最小表格**（M0-4/5）

如果你愿意，我可以**直接给你可拷贝的 React 组件代码**（包含：输入 → 并发 DoH→RDAP→ 表格渲染 →CSV 导出），你贴进 `App.tsx` 就能看到第一版结果。
