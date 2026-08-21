---
name: project_architecture
description: "独行青年安全守护应用的项目架构、目录分层和关键约定"
metadata:
  node_type: memory
  type: lesson
  status: active
  scopes: [architecture]
  applies_to: [frontend]
  triggers: ["项目结构", "架构", "目录", "分层", "层", "依赖方向", "frontend/src", "代码组织"]
  last_verified: 2026-08-19
  expires_at: null
  authority: observed
  authority_docs: ["readme.md"]
  history_docs: []
  supersedes: []
  code_evidence:
    - {path: "frontend/src/App.tsx", symbols: [], tests: []}
    - {path: "frontend/src/main.tsx", symbols: [], tests: []}
    - {path: "frontend/package.json", symbols: [], tests: []}
  evidence: [readme-project-layout]
---

# 项目架构

## 技术栈
- 前端：React 19 + TypeScript + MUI 6 + Zustand 5 + Vite 7
- 移动端：Capacitor 6 Android 壳
- 后端：FastAPI + SQLite（**已弃用**，代码已移除，仅保留归档）
- 版本：0.9.2

## 代码分层（frontend/src/）

| 层 | 目录 | 职责 | 依赖方向 |
|---|---|---|---|
| DOM/入口 | `main.tsx`, `App.tsx`, `providers/` | React 渲染入口，全局 Provider 挂载，路由分发 | ↓ pages/shell |
| 页面 | `pages/` | 单页组件，组合 UI 与数据，不直接操作 native/持久化 | ↓ stores/hooks/components |
| 外壳 | `shell/` | 布局（AppBar/Drawer/导航），纯 UI 编排 | ↓ stores |
| 组件 | `components/` | 跨页复用 UI 片段 | 无依赖 |
| Hook | `hooks/` | 纯 React hooks | ↓ stores |
| 状态 | `stores/` | Zustand store，业务状态与副作用编排 | ↓ data/domain |
| 数据 | `data/` | 持久化封装（repo 文件 + storage 抽象），native 桥接转发 | ↓ native |
| 领域 | `domain/` | 纯函数，零 IO，无外部依赖 | 无依赖 |
| 原生 | `native/` | Capacitor 插件封装（短信/电话/定位/权限） | ↓ @capacitor/* |
| AI | `ai/` | AI 对话 store/service/tools/context/memory | ↓ stores |
| 类型 | `types/` | TypeScript 类型定义 | 无依赖 |
| 主题 | `theme/` | 主题 token 和 createTheme | 无依赖 |
| 国际化 | `i18n/` | 中文语言包 | 无依赖 |

## 关键架构约定
1. **页面不直接 import native/，不直接操作持久化**（工具页除外）。
2. **Store 通过 data/ repo 文件读写持久化**，不直接 import storage.ts。
3. **Store 通过 data 层转发调用 native 能力**，不直接 import native 模块。
4. **domain 层零 IO、零外部依赖**，仅纯函数。
5. 导航：底栏 6 Tab 为主导航，侧边栏辅助页。
6. 不可承诺：Android 长时后台保活、被系统杀死后追踪、自动报警、实时地图监护。
7. 可承诺：前台/应用存活期间的手动 SOS + 周期采样 + 本地队列/本地确认能力。

## 主要页面
home（首页 SOS + 卡片）、sos（SOS 倒计时 + 结果）、history（SOS 历史）、playback（轨迹回放）、tracking（轨迹列表）、config（配置）、contacts（联系人）、theme（主题）、tools（开发者工具）、smartRules（规则引擎）、ai（AI 陪伴）、ai-config（AI 配置）、trip（安全行程历史）、messages（消息占位）、scenes（场景占位）、membership（会员）、profile（个人占位）