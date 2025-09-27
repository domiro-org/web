# Domiro 项目智能代理规范 (AGENTS.md)

本文件用于给 AI/Codex/协作开发代理提供项目上下文与规范指引。  
请所有生成的代码或修改 **严格遵循以下要求**。

---

## 1. 项目总体规范

- **框架**：React + Vite + TypeScript
- **UI**：Material UI (MUI v5)，启用 **Material Design 3 (MD3)** 主题
- **状态管理**：React 自带 Hooks (useState/useReducer/useContext)，不引入额外库
- **代码风格**：
  - 使用 TypeScript，开启严格模式
  - 格式化工具：Prettier（2 空格缩进）
  - 文件命名：组件文件用大写驼峰，如 `DomainTable.tsx`；工具函数用小写驼峰，如 `rdapCheck.ts`
- **注释习惯**：
  - 每个工具函数顶部写 JSDoc 注释（参数、返回值、用途）
  - 复杂逻辑块用 `//` 单行注释说明关键思路
  - 所有 TODO/未来计划写入 `TODO.md`，不要散落在代码

---

## 2. 国际化 (i18n) 规范

- **库**：`i18next` + `react-i18next`
- **语言代码**：使用 BCP-47 标准
  - 简体中文：`zh-Hans`
  - 英文（美国）：`en-US`
- **目录结构**：

```file
src/locales/
zh-Hans/common.json
en-US/common.json
```

- **Key 规范**：
- 使用 **语义化层级**：如 `table.domain`、`status.available`
- 避免整句当 key
- 变量用 `{{var}}` 占位符（例：`"welcome": "欢迎，{{name}}"`）
- **新增语言**：通过 Weblate 平台生成文件，不手工复制

---

## 3. DNS & RDAP 查询逻辑规范

- **DNS 查询**：
- 使用 DoH (DNS over HTTPS)，默认优先 Google 和 Cloudflare
- 查询记录类型：`NS`（必要时 `SOA`）
- 结果语义：
  - `has-ns` → 已委派 → 可能已注册
  - `no-ns`/`nxdomain` → 疑似未注册 → 需 RDAP 校验
- **RDAP 查询**：
- 默认请求 gTLD 的 RDAP 服务（通过 IANA bootstrap 或直接调用常见注册商）
- 结果语义：
  - `404` → 未注册
  - `200` → 已注册
  - `429` → 遵守 `Retry-After`，指数退避
- **WHOIS 兜底**：
- 仅对无 RDAP 的 ccTLD 使用
- 通过代理请求，不在浏览器直接调用 43 端口

---

## 4. UI 与交互规范

- **主题**：启用 MUI `CssVarsProvider`，使用 MD3 色板和圆角
- **界面元素**：
- 输入区：多行输入框 (TextField)
- 操作区：检查按钮 + 语言切换下拉框
- 结果区：MUI 表格 (Table) 或 DataGrid
- **交互规则**：
- 批量查询需有进度状态（loading / done / error）
- 错误提示使用 Snackbar 或 ErrorText，避免 alert
- 导出功能支持 CSV（UTF-8 with BOM）

---

## 5. 代理行为规范 (对 Codex 的指引)

- 生成代码时：
- **必须遵守上述规范**
- **必须用中文注释**说明核心逻辑
- 不允许：
- 引入未在本文件批准的额外依赖
- 硬编码翻译文本（必须放入 i18n JSON）
- 如果遇到未定义情况：
- 在代码中加 `// TODO:` 注释，并同步到 `TODO.md`