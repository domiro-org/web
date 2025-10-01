# Domiro

Translations:

- [English](README.md)
- [简体中文](README.zh-Hans.md)

Domiro 将 DNS 预筛与 RDAP 校验整合到一个可靠的工作空间，帮助团队高效完成域名资格筛查。批量导入、智能去重与导出能力，让收购团队在投入预算前迅速验证域名资产。应用基于 **React**、**Vite** 与 **Material UI（MD3）** 构建，具备跨平台的响应式体验。

## 功能

- 支持手动输入、CSV/TXT 上传或模式生成，自动完成清洗与去重
- 通过多提供商 DoH 检测委派状态，并标记 RDAP 待查域名
- 执行具备限流策略的 RDAP 查询，并导出结构化结果供后续系统使用

## 开发环境

- Node.js v22
- 包管理器：npm

## 启动

```bash
npm install
npm run dev
```
