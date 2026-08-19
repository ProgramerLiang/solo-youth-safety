---
name: recent_development_history
description: "项目近期开发重点和演进方向"
metadata:
  node_type: memory
  type: lesson
  status: active
  scopes: [development]
  applies_to: [frontend]
  triggers: ["最近提交", "最近开发", "AI", "导航", "底栏", "近期变更", "git log", "近期开发重点"]
  last_verified: 2026-08-19
  expires_at: null
  authority: observed
  authority_docs: []
  history_docs: []
  supersedes: []
  code_evidence: []
  evidence: [git-log-recent]
---

# 近期开发重点（截至2026-08-19）

## 最近开发方向
1. **AI 陪伴助手** — 多对话管理、Markdown 渲染、OpenAI Function Calling 工具、防提示词攻击、独立 AI 配置页面
2. **底栏导航重构** — 6 Tab（首页/消息/场景/AI/会员/我的），含横向滑动、弹跳动画
3. **OwnMem 记忆系统初始化** — 最新提交配置了 ownmem v0.2.0

## 最近提交链（最前为最新）
- 配置 OwnMem 项目记忆系统
- v0.8.9 chore
- 安全行程导航目标改为 trip 路由
- v0.8.8 chore
- 场景-安全行程目标从 smartRules 改为 home
- 清理会员卡和事件 Tab 残留
- 进入 APP 默认打开首页（去除配置页重定向）
- 恢复消息和会员 Tab，6Tab 填满底栏宽度
- 底栏压缩为 4Tab + 动画 + 横向滑动；场景合并消息，我的合并会员
- AI 多对话历史管理 + AI 配置独立页 + 底栏 AI 按钮
- AI 系统提示词增加 App 用法指南 + 防提示词攻击

## 注意
- 导航结构经过多次迭代：4Tab→6Tab，当前为 6Tab 稳定形态
- AI 功能标记为 debug 包可用